"""Rebuild JAM's independent sample pack from a licensed local archive; never edit the source."""
import argparse, array, hashlib, json, math, pathlib, shutil, subprocess, wave

p = argparse.ArgumentParser()
p.add_argument('--source', type=pathlib.Path, required=True)
p.add_argument('--ffmpeg', required=True)
args = p.parse_args()
root = pathlib.Path(__file__).resolve().parents[1]
dest = root / 'web' / 'samples'
dest.mkdir(parents=True, exist_ok=True)
specs = [
    dict(id='piano', name='グランドピアノ', family='鍵盤', folder='grand-piano', kind='pluck', min=36, max=96, octave=4, attack=.004, release=.28, gain=.72, source='VCSL Keys / Grand Piano K — Versilian Studios', url='https://versilian-studios.com/vcsl-keys/', license='CC0-1.0'),
    dict(id='guitar', name='アコースティックギター', family='弦', folder='acoustic_guitar', kind='pluck', min=45, max=88, octave=4, attack=.003, release=.18, gain=.70, source='FreePats Spanish Classical Guitar — roberto@zenvoid.org', url='https://freepats.zenvoid.org/Guitar/acoustic-guitar.html', license='CC0-1.0'),
    dict(id='bass', name='エレキベース', family='弦', folder='electric_bass', kind='pluck', min=28, max=67, octave=2, attack=.004, release=.16, gain=.65, source='FreePats Bass Guitar YR Picked — Andrea Biasior', url='https://freepats.zenvoid.org/ElectricGuitar/clean-electric-bass.html', license='CC0-1.0'),
    dict(id='clarinet', name='クラリネット', family='管', folder='clarinet', kind='wind', min=50, max=84, octave=4, attack=.028, release=.09, gain=.53, source='FreePats Clarinet — Tyler Dence / Kaili Dence', url='https://freepats.zenvoid.org/Reed/clarinet.html', license='CC0-1.0'),
    dict(id='drums', name='ドラム', family='打楽器', folder='acoustic_drums', kind='drums', min=36, max=51, octave=2, attack=.002, release=.05, gain=.68, source='MuldjordKit — Lars Muldjord, FreePats edition by roberto@zenvoid.org', url='https://freepats.zenvoid.org/Percussion/acoustic-drum-kit.html', license='CC-BY-4.0'),
]
drums = {'kick':(36,'キック'), 'snare':(38,'スネア'), 'closed_hat':(42,'ハイハット'), 'open_hat':(46,'オープンHH'), 'low_tom':(45,'ロータム'), 'high_tom':(50,'ハイタム'), 'crash':(49,'クラッシュ'), 'ride':(51,'ライド')}
provenance, metrics = [], []
for spec in specs:
    source = args.source / spec['folder']
    spec['max'] = {'piano':93, 'guitar':87, 'bass':43, 'clarinet':84, 'drums':51}[spec['id']]
    spec['gain'] = {'piano':.9, 'guitar':.85, 'bass':.8, 'clarinet':.75, 'drums':.9}[spec['id']]
    mapping = json.loads((source/'map.json').read_text('utf-8-sig'))
    target = dest / spec['id']; target.mkdir(exist_ok=True)
    spec['samples'] = []
    for sample in mapping['samples']:
        if spec['kind']=='drums' and sample.get('name') not in drums: continue
        origin = source/sample['file']
        digest = hashlib.sha256(origin.read_bytes()).hexdigest()
        if digest != sample['sha256']: raise ValueError(f'Source hash changed: {origin.name}')
        pitch = drums[sample['name']][0] if spec['kind']=='drums' else sample['midi']
        record = dict(midi=pitch,layer=sample.get('layer',4),tune=sample.get('tune',0))
        if spec['kind']=='drums': record['label']=drums[sample['name']][1]
        # Read PCM only for analysis and a seam-safe sustained wind loop.
        raw = subprocess.run([args.ffmpeg,'-v','error','-i',str(origin),'-f','f32le','-ac','1','-ar','32000','pipe:1'],check=True,capture_output=True).stdout
        signal = array.array('f'); signal.frombytes(raw); sr=32000
        peak=max(abs(x) for x in signal)
        if not len(signal) or not math.isfinite(peak) or peak==0: raise ValueError('Invalid audio')
        rms=math.sqrt(sum(x*x for x in signal)/len(signal))
        attack_rms=math.sqrt(sum(x*x for x in signal[:sr])/min(len(signal),sr))
        record['gain']=min(16,.15/max(.002,attack_rms))*(.65 if record['layer']==2 else 1)
        if spec['kind']=='wind':
            # Match the steady waveform, then crossfade the pre-loop region into the tail.
            start=int(.65*sr); window=int(.06*sr)
            segment=signal[start-window:start]
            best=None
            for end in range(int(1.35*sr), min(int(2.3*sr),len(signal)-window),8):
                tail=signal[end-window:end]
                score=sum((a-b)**2 for a,b in zip(tail[::16],segment[::16]))
                if best is None or score<best[0]: best=(score,end)
            end=best[1]
            for i in range(window):
                t=i/(window-1)
                signal[end-window+i]=(1-t)*signal[end-window+i]+t*segment[i]
            signal=signal[:end]
            # Normalise entire instrument moderately, not every note to the same peak.
            filename=f'p{pitch}.wav'
            with wave.open(str(target/filename),'wb') as out:
                out.setnchannels(1); out.setsampwidth(2); out.setframerate(sr)
                out.writeframes(array.array('h',(round(max(-.98,min(.98,x))*32767) for x in signal)).tobytes())
            record.update(loopStart=start/sr,loopEnd=end/sr)
            seam=abs(float(signal[-1]-signal[start]))
        else:
            filename=sample['file']; shutil.copyfile(origin,target/filename); seam=None
        record['file']=f'samples/{spec["id"]}/{filename}'
        record['sha256']=hashlib.sha256((target/filename).read_bytes()).hexdigest()
        record['duration']=len(signal)/sr
        spec['samples'].append(record)
        provenance.append(dict(instrument=spec['id'],file=record['file'],sourceFile=f'{spec["folder"]}/{sample["file"]}',sourceSha256=digest,sha256=record['sha256']))
        metrics.append(dict(file=record['file'],peak=peak,rms=rms,loopSeam=seam))
    del spec['folder']
(root/'web'/'catalog.json').write_text(json.dumps(dict(version=1,instruments=specs),ensure_ascii=False,indent=2)+'\n','utf-8')
licenses=root/'licenses'; licenses.mkdir(exist_ok=True)
shutil.copyfile(args.source/'acoustic_drums'/'LICENSE_CC_BY_4.0.txt',licenses/'CC-BY-4.0.txt')
shutil.copyfile(args.source/'electric_guitar'/'LICENSE_CC0.txt',licenses/'CC0-1.0.txt')
(licenses/'sample-provenance.json').write_text(json.dumps(provenance,indent=2)+'\n','utf-8')
evidence=root.parent/'.flecity-dev'/'jam'; evidence.mkdir(exist_ok=True,parents=True)
(evidence/'sample-analysis.json').write_text(json.dumps(metrics,indent=2)+'\n','utf-8')
print(json.dumps(dict(instruments=len(specs),samples=len(provenance),bytes=sum(f.stat().st_size for f in dest.rglob('*') if f.is_file()),maxSeam=max(x['loopSeam'] or 0 for x in metrics))))
