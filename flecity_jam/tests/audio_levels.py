"""Check the shipped samples and the piano's MIDI velocity-layer boundary."""

import array
import hashlib
import importlib.util
import json
import math
import pathlib
import shutil
import subprocess
import unittest


WEB = pathlib.Path(__file__).resolve().parents[1] / 'web'
SAMPLE_RATE = 32000  # Match the importer's mono measurement rate.
VOICE_GAIN = .26  # AudioRack's per-voice coefficient, before UI volume sliders.


def rms(values):
    return math.sqrt(sum(value * value for value in values) / len(values))


class AudioLevelTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ffmpeg = shutil.which('ffmpeg')
        if not cls.ffmpeg:
            raise RuntimeError('ffmpeg is required for the audio-level regression test')
        catalog = json.loads((WEB / 'catalog.json').read_text(encoding='utf-8'))
        cls.instruments = {spec['id']: spec for spec in catalog['instruments']}
        cls.provenance = json.loads((WEB.parent / 'licenses/sample-provenance.json').read_text(encoding='utf-8'))
        module_spec = importlib.util.spec_from_file_location('jam_append_samples', WEB.parent / 'devtools/append_samples.py')
        cls.importer = importlib.util.module_from_spec(module_spec)
        module_spec.loader.exec_module(cls.importer)
        cls.metrics = {}

    @classmethod
    def measure(cls, sample):
        filename = sample['file']
        if filename not in cls.metrics:
            result = subprocess.run(
                [cls.ffmpeg, '-v', 'error', '-i', str(WEB / filename),
                 '-f', 'f32le', '-ac', '1', '-ar', str(SAMPLE_RATE), 'pipe:1'],
                check=True, capture_output=True,
            )
            signal = array.array('f')
            signal.frombytes(result.stdout)
            if not signal:
                raise ValueError(f'Empty audio: {filename}')
            cls.metrics[filename] = (
                rms(signal[:min(len(signal), SAMPLE_RATE // 2)]),
                max(abs(value) for value in signal),
                rms(signal[-min(len(signal), SAMPLE_RATE):]),
            )
        return cls.metrics[filename]

    def test_all_shipped_samples_match_catalog_hashes(self):
        samples = [sample for spec in self.instruments.values() for sample in spec['samples']]
        self.assertEqual(sum(len(spec['samples']) for spec in list(self.instruments.values())[:5]), 58)
        self.assertEqual(len(samples), 91)
        self.assertEqual(len(self.provenance), len(samples))
        for sample in samples:
            with self.subTest(file=sample['file']):
                path = WEB / sample['file']
                self.assertTrue(path.is_file())
                self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), sample['sha256'])

    def test_original_catalog_and_provenance_entries_are_unchanged(self):
        canonical = lambda value: json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()
        self.assertEqual(hashlib.sha256(canonical(list(self.instruments.values())[:5])).hexdigest(),
                         '738e72784a66e329537915441f4c08fb81a083c4213d1d00ff34a1a9d45668ff')
        self.assertEqual(hashlib.sha256(canonical(self.provenance[:58])).hexdigest(),
                         'a34370c395360a56fd26b91e7b4959b824095991ef6d34985c4191a6ed12f965')
        for record in self.provenance[:58]:
            self.assertEqual(hashlib.sha256((WEB / record['file']).read_bytes()).hexdigest(), record['sha256'])

    def test_new_samples_have_headroom_and_bounded_sustained_loops(self):
        for identifier in ['electric_guitar', 'flute', 'violin']:
            spec = self.instruments[identifier]
            for sample in spec['samples']:
                with self.subTest(file=sample['file']):
                    _, peak, tail = self.measure(sample)
                    self.assertLessEqual(peak * sample['gain'], .70001)
                    self.assertLess(peak * sample['gain'] * spec['gain'] * VOICE_GAIN, .15)
                    self.assertTrue(math.isfinite(sample['tune']) and abs(sample['tune']) < 40)
                    if identifier != 'electric_guitar':
                        self.assertGreater(sample['loopStart'], 0)
                        self.assertLess(sample['loopStart'], sample['loopEnd'])
                        self.assertLessEqual(sample['loopEnd'], sample['duration'])
                        self.assertGreater(tail, 1e-4)

    def test_new_root_calibration_and_metadata_respect_source_octaves(self):
        new_records = {entry['file']: entry for entry in self.provenance[58:]}
        for identifier in ['electric_guitar', 'flute', 'violin']:
            for sample in self.instruments[identifier]['samples']:
                with self.subTest(file=sample['file']):
                    source = new_records[sample['file']]
                    self.assertEqual(source['pitchOffset'], 0 if identifier == 'electric_guitar' else 12)
                    self.assertEqual(sample['midi'], source['sourceMidi'] + source['pitchOffset'])
                    signal = self.importer.decode(self.ffmpeg, WEB / sample['file'])
                    residual = self.importer.pitch_cents(signal, sample['midi']) + sample['tune']
                    self.assertLess(abs(residual), .5)
                    if identifier != 'electric_guitar':
                        # The join reproduces the original adjacent-sample step, including high notes.
                        self.assertAlmostEqual(signal[-1], signal[round(sample['loopStart'] * SAMPLE_RATE) - 1], places=5)

    def test_all_eight_instruments_fit_existing_decoded_cache_limit(self):
        decoded_bytes = sum(round(sample['duration'] * SAMPLE_RATE) * 4
                            for spec in self.instruments.values() for sample in spec['samples'])
        self.assertEqual(len(self.instruments), 8)
        self.assertLess(decoded_bytes, 64 * 1024 * 1024)

    def test_repeated_append_stops_before_changing_existing_assets(self):
        before = hashlib.sha256((WEB / 'catalog.json').read_bytes()).hexdigest()
        with self.assertRaisesRegex(ValueError, 'CONFLICT_STOP'):
            self.importer.append(WEB / 'samples', self.ffmpeg, apply=True)
        self.assertEqual(hashlib.sha256((WEB / 'catalog.json').read_bytes()).hexdigest(), before)

    def test_piano_velocity_74_to_75_has_no_loudness_cliff(self):
        piano = self.instruments['piano']
        pairs = {}
        for sample in piano['samples']:
            pairs.setdefault(sample['midi'], {})[sample['layer']] = sample
        self.assertEqual(len(pairs), 13)
        for pitch, layers in pairs.items():
            with self.subTest(midi=pitch):
                self.assertEqual(set(layers), {2, 4})
                soft, forte = layers[2], layers[4]
                soft_level = self.measure(soft)[0] * soft['gain'] * (74 / 127) ** 1.4
                forte_level = self.measure(forte)[0] * forte['gain'] * (75 / 127) ** 1.4
                difference_db = 20 * math.log10(forte_level / soft_level)
                self.assertLessEqual(abs(difference_db), 2, f'MIDI {pitch}: {difference_db:.2f} dB')

    def test_soft_layers_have_headroom_and_quiet_tails(self):
        piano = self.instruments['piano']
        for sample in piano['samples']:
            if sample['layer'] != 2:
                continue
            with self.subTest(midi=sample['midi']):
                _, peak, tail = self.measure(sample)
                gain = sample['gain'] * piano['gain'] * VOICE_GAIN * (74 / 127) ** 1.4
                # 100% performance and listening sliders: before the limiter.
                self.assertLess(peak * gain, .8)
                self.assertLess(tail * gain, 10 ** (-50 / 20))

    def test_bass_default_octave_reaches_most_keys(self):
        bass = self.instruments['bass']
        first = (bass['octave'] + 1) * 12
        available = sum(bass['min'] <= first + offset <= bass['max'] for offset in range(18))
        self.assertGreaterEqual(available, 12)


if __name__ == '__main__':
    unittest.main()
