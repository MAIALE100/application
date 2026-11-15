"""Initial deployment safety checks; never writes to the real server."""
import hashlib
import importlib.util
import json
import pathlib
import tempfile
import unittest
import zipfile

root = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('jam_installer', root / 'devtools' / 'install.py')
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class InitialInstallTests(unittest.TestCase):
    def setUp(self):
        installer.FIXTURES.mkdir(parents=True, exist_ok=True)
        self.base = pathlib.Path(tempfile.mkdtemp(prefix='case-', dir=installer.FIXTURES))
        self.resources = self.base / 'resources'
        self.resources.mkdir()
        package = json.loads((installer.STATE / 'dist' / 'package-result.json').read_text(encoding='utf-8'))
        self.archive, self.digest = pathlib.Path(package['file']), package['sha256']

    def test_plan_has_no_server_writes(self):
        result = installer.install(self.archive, self.digest, fixture_resources=self.resources)
        self.assertEqual(result['status'], 'PLAN')
        self.assertEqual(list(self.resources.iterdir()), [])

    def test_initial_install_and_existing_config_protection(self):
        result = installer.install(self.archive, self.digest, True, self.resources)
        self.assertEqual(result['status'], 'INSTALLED')
        config = self.resources / 'flecity_jam' / 'config.lua'
        config.write_text('-- local config must survive', encoding='utf-8')
        with self.assertRaises(FileExistsError):
            installer.install(self.archive, self.digest, True, self.resources)
        self.assertEqual(config.read_text(encoding='utf-8'), '-- local config must survive')

    def test_bad_zip_digest(self):
        with self.assertRaisesRegex(ValueError, 'SHA-256'):
            installer.install(self.archive, '0' * 64, True, self.resources)
        self.assertFalse((self.resources / 'flecity_jam').exists())

    def test_untrusted_manifest_and_traversal(self):
        for case in ['manifest', 'traversal']:
            forged = self.base / (case + '.zip')
            with zipfile.ZipFile(self.archive) as original, zipfile.ZipFile(forged, 'w') as output:
                for item in original.infolist():
                    data = original.read(item.filename)
                    if case == 'manifest' and item.filename == 'flecity_jam/config.lua':
                        data += b'-- changed'
                    output.writestr(item.filename, data)
                if case == 'traversal':
                    output.writestr('flecity_jam/../escape.lua', b'invalid')
            digest = hashlib.sha256(forged.read_bytes()).hexdigest()
            with self.assertRaises(ValueError):
                installer.install(forged, digest, True, self.resources)
            self.assertFalse((self.resources / 'flecity_jam').exists())

    def test_fixture_cannot_target_real_server(self):
        with self.assertRaisesRegex(ValueError, 'Fixtures'):
            installer.install(self.archive, self.digest, True, installer.RESOURCES)


if __name__ == '__main__':
    unittest.main()
