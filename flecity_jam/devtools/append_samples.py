"""Append three licensed instruments without rebuilding JAM's original five."""
import argparse
import array
import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess
import tempfile
import wave

ROOT = Path(__file__).resolve().parents[1]
RATE = 32000
SPECS = [
    dict(id='electric_guitar', name='クリーンエレキギター', family='弦', kind='pluck', min=40, max=85,
         octave=4, attack=.004, release=.18, gain=.75, pitchOffset=0,
         source='FreePats FSBS Electric Guitar Clean #1 small',
         url='https://freepats.zenvoid.org/ElectricGuitar/clean-electric-guitar.html', license='CC0-1.0'),
    dict(id='flute', name='フルート', family='管', kind='wind', min=60, max=93,
         octave=5, attack=.025, release=.10, gain=.75, pitchOffset=12,
         source='Versilian Studios VSCO 2 Community Edition — Sam Gossner / Simon Dalzell',
         url='https://github.com/sgossner/VSCO-2-CE', license='CC0-1.0'),
    dict(id='violin', name='ヴァイオリン', family='弦', kind='sustain', min=55, max=86,
         octave=4, attack=.035, release=.16, gain=.75, pitchOffset=12,
         source='Versilian Studios VSCO 2 Community Edition — Sam Gossner / Simon Dalzell',
         url='https://github.com/sgossner/VSCO-2-CE', license='CC0-1.0'),
]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def decode(ffmpeg, path):
    raw = subprocess.run([ffmpeg, '-v', 'error', '-i', str(path), '-f', 'f32le',
                          '-ac', '1', '-ar', str(RATE), 'pipe:1'], check=True, capture_output=True).stdout
    signal = array.array('f'); signal.frombytes(raw)
    if len(signal) < RATE or any(not math.isfinite(value) for value in signal):
        raise ValueError(f'Invalid sample: {path.name}')
    return signal


def rms(signal):
    return math.sqrt(sum(value * value for value in signal) / len(signal))


def pitch_cents(signal, midi):
    """Refine the known root using waveform periodicity, never octave-guess a harmonic."""
    segment = signal[int(.4 * RATE):int(.7 * RATE)]
    expected = RATE / (440 * 2 ** ((midi - 69) / 12))
    low, high = max(2, math.floor(expected * .96)), math.ceil(expected * 1.04)
    size = min(6000, len(segment) - high - 2)
    differences = {lag: sum((segment[j] - segment[j + lag]) ** 2 for j in range(size))
                   for lag in range(low, high + 1)}
    lag = min(range(low + 1, high), key=differences.get)
    left, center, right = (differences[lag + offset] for offset in (-1, 0, 1))
    denominator = left - 2 * center + right
    refined = lag + (left - right) / (2 * denominator) if denominator else lag
    cents = 1200 * math.log2(expected / refined)
    if not math.isfinite(cents) or abs(cents) > 40:
        raise ValueError(f'Root pitch requires manual review: MIDI {midi}, {cents:.2f} cents')
    return cents


def sustained_loop(signal):
    # Reuse the clarinet importer's phase match and 60ms crossfade, new samples only.
    start, window = int(.65 * RATE), int(.06 * RATE)
    segment = signal[start - window:start]
    _, end = min((sum((a - b) ** 2 for a, b in zip(signal[pos - window:pos:16], segment[::16])), pos)
                 for pos in range(int(1.35 * RATE), min(int(2.3 * RATE), len(signal) - window), 8))
    output = array.array('f', signal[:end])
    for i in range(window):
        mix = i / (window - 1)
        output[end - window + i] = (1 - mix) * output[end - window + i] + mix * segment[i]
    return output, start, end


def append(source, ffmpeg, apply=False):
    web, provenance_path = ROOT / 'web', ROOT / 'licenses/sample-provenance.json'
    catalog_path = web / 'catalog.json'
    old_catalog, old_provenance = catalog_path.read_bytes(), provenance_path.read_bytes()
    catalog = json.loads(old_catalog); provenance = json.loads(old_provenance)
    if [spec['id'] for spec in catalog['instruments']] != ['piano', 'guitar', 'bass', 'clarinet', 'drums'] or len(provenance) != 58:
        raise ValueError('CONFLICT_STOP: expected the original five instruments and 58 samples')
    protected = {record['file']: digest((web / record['file']).read_bytes()) for record in provenance}
    if any(protected[record['file']] != record['sha256'] for record in provenance):
        raise ValueError('CONFLICT_STOP: original sample hash mismatch')
    report = dict(scope='Local source import and PCM analysis only; FiveM listening NOT_RUN',
                  applied=apply, source=str(source), originalFiles=58, instruments=[], samples=[])
    with tempfile.TemporaryDirectory(prefix='jam-append-samples-') as temporary:
        stage = Path(temporary)
        for template in SPECS:
            spec = dict(template); offset = spec.pop('pitchOffset'); identifier = spec['id']
            folder = (source / identifier).resolve(); target = web / 'samples' / identifier
            if target.exists():
                raise ValueError(f'CONFLICT_STOP: new target already exists: {identifier}')
            mapping = json.loads((folder / 'map.json').read_text(encoding='utf-8-sig'))
            if mapping.get('license') != 'CC0-1.0':
                raise ValueError(f'Unverified license: {identifier}')
            output_folder = stage / identifier; output_folder.mkdir()
            spec['samples'] = []
            for entry in mapping['samples']:
                origin = (folder / entry['file']).resolve()
                if not origin.is_relative_to(folder) or digest(origin.read_bytes()) != entry['sha256']:
                    raise ValueError(f'CONFLICT_STOP: invalid source: {identifier}/{entry["file"]}')
                midi = entry['midi'] + offset
                signal = decode(ffmpeg, origin); source_peak = max(abs(value) for value in signal)
                if not source_peak:
                    raise ValueError(f'Silent sample: {identifier}/{entry["file"]}')
                cents = pitch_cents(signal, midi)
                record = dict(midi=midi, layer=entry.get('layer', 4), tune=round(-cents, 4))
                if spec['kind'] == 'pluck':
                    filename = entry['file']; shutil.copyfile(origin, output_folder / filename)
                else:
                    signal, start, end = sustained_loop(signal); filename = f'p{midi}.wav'
                    # Existing VSCO sources are below full scale; refuse silent clipping.
                    if max(abs(value) for value in signal) >= .98:
                        raise ValueError(f'Loop needs explicit attenuation: {identifier}/{filename}')
                    with wave.open(str(output_folder / filename), 'wb') as output:
                        output.setnchannels(1); output.setsampwidth(2); output.setframerate(RATE)
                        output.writeframes(array.array('h', (round(value * 32767) for value in signal)).tobytes())
                    record.update(loopStart=start / RATE, loopEnd=end / RATE)
                    signal = decode(ffmpeg, output_folder / filename)
                peak = max(abs(value) for value in signal)
                # Cap every new voice's raw peak at .7 before the existing instrument/voice gains.
                record['gain'] = min(16, .12 / max(.002, rms(signal[:RATE])), .7 / peak)
                record.update(file=f'samples/{identifier}/{filename}',
                              sha256=digest((output_folder / filename).read_bytes()), duration=len(signal) / RATE)
                spec['samples'].append(record)
                provenance.append(dict(instrument=identifier, file=record['file'],
                                       sourceFile=f'{identifier}/{entry["file"]}', sourceSha256=entry['sha256'],
                                       sourceMidi=entry['midi'], pitchOffset=offset, sha256=record['sha256']))
                seam = abs(signal[-1] - signal[int(record['loopStart'] * RATE)]) if 'loopStart' in record else None
                report['samples'].append(dict(instrument=identifier, file=record['file'], midi=midi,
                                              sourcePeak=source_peak, peak=peak, rms=rms(signal),
                                              effectivePeak=peak * record['gain'] * spec['gain'] * .26,
                                              rootCorrectionCents=record['tune'], loopSeam=seam,
                                              decodedBytes=len(signal) * 4, sha256=record['sha256']))
            catalog['instruments'].append(spec)
            report['instruments'].append(dict(id=identifier, samples=len(spec['samples']), min=spec['min'], max=spec['max']))
        old_seconds = sum(sample['duration'] for spec in catalog['instruments'][:5] for sample in spec['samples'])
        report['decodedBytes'] = round(old_seconds * RATE * 4) + sum(sample['decodedBytes'] for sample in report['samples'])
        if report['decodedBytes'] > 64 * 1024 * 1024:
            raise ValueError('Decoded cache would exceed 64 MiB')
        if apply:
            if catalog_path.read_bytes() != old_catalog or provenance_path.read_bytes() != old_provenance \
                    or any(digest((web / file).read_bytes()) != sha for file, sha in protected.items()):
                raise ValueError('CONFLICT_STOP: catalog, provenance or original samples changed during append')
            for spec in SPECS:
                shutil.copytree(stage / spec['id'], web / 'samples' / spec['id'])
            catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
            provenance_path.write_text(json.dumps(provenance, indent=2) + '\n', encoding='utf-8')
        assert all(digest((web / file).read_bytes()) == sha for file, sha in protected.items())
        if apply:
            assert json.loads(catalog_path.read_bytes())['instruments'][:5] == json.loads(old_catalog)['instruments']
            assert json.loads(provenance_path.read_bytes())[:58] == json.loads(old_provenance)
        report.update(originalSamplesUnchanged=True, originalCatalogEntriesUnchanged=True,
                      originalProvenanceUnchanged=True, oldCatalogSha256=digest(old_catalog), oldProvenanceSha256=digest(old_provenance))
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--ffmpeg', default=shutil.which('ffmpeg'), required=not shutil.which('ffmpeg'))
    parser.add_argument('--report', type=Path, required=True)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    result = append(args.source.resolve(), args.ffmpeg, args.apply)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({key: result[key] for key in ['applied', 'instruments', 'decodedBytes', 'originalSamplesUnchanged']}))
