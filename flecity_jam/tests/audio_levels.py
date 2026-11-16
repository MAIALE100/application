"""Check the shipped samples and the piano's MIDI velocity-layer boundary."""

import array
import hashlib
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
        self.assertEqual(len(samples), 58)
        for sample in samples:
            with self.subTest(file=sample['file']):
                path = WEB / sample['file']
                self.assertTrue(path.is_file())
                self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), sample['sha256'])

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
