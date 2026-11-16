"""Installer tests operate only in an isolated JAM fixture directory."""

import hashlib
import importlib.util
import json
import pathlib
import tempfile
import unittest
import zipfile
from unittest import mock


ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('jam_installer', ROOT / 'devtools' / 'install.py')
installer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(installer)
PACKAGE_SPEC = importlib.util.spec_from_file_location('jam_packager', ROOT / 'devtools' / 'package.py')
packager = importlib.util.module_from_spec(PACKAGE_SPEC)
PACKAGE_SPEC.loader.exec_module(packager)


def sha(content):
    return hashlib.sha256(content).hexdigest()


class InstallTests(unittest.TestCase):
    def setUp(self):
        installer.FIXTURES.mkdir(parents=True, exist_ok=True)
        self.base = pathlib.Path(tempfile.mkdtemp(prefix='case-', dir=installer.FIXTURES))
        self.resources = self.base / 'resources'
        self.resources.mkdir()
        self.archive, self.digest = self.make_archive('original')

    def make_archive(self, label, config=b'JamConfig = {}\n', web=b'<html>original</html>'):
        data = {'fxmanifest.lua': b"version '0.1.0-test'\n",
                'config.lua': config,
                'client/main.lua': b'-- client\n',
                'server/main.lua': b'-- server\n',
                'web/index.html': web}
        hashes = {name: sha(content) for name, content in data.items()}
        runtime = sha(json.dumps(hashes, sort_keys=True,
                                 separators=(',', ':')).encode())
        manifest = json.dumps(dict(version='0.1.0-test', files=hashes,
                                   runtimeSha256=runtime)).encode()
        archive = self.base / (label + '.zip')
        with zipfile.ZipFile(archive, 'w') as output:
            for name, content in data.items():
                output.writestr('flecity_jam/' + name, content)
            output.writestr('flecity_jam/MANIFEST.json', manifest)
        return archive, sha(archive.read_bytes())

    def baseline(self):
        target = self.resources / 'flecity_jam'
        rows = []
        for path in target.rglob('*'):
            if path.is_file():
                rows.append(dict(path=path.relative_to(target).as_posix(),
                                 bytes=path.stat().st_size, sha256=sha(path.read_bytes())))
        baseline = self.base / 'baseline.json'
        baseline.write_text(json.dumps(dict(files=rows)), encoding='utf-8')
        return baseline, sha(baseline.read_bytes()), installer.file_map(
            {row['path']: (target / row['path']).read_bytes() for row in rows})

    def initial(self):
        result = installer.install(self.archive, self.digest, True, self.resources)
        self.assertEqual(result['status'], 'INSTALLED')
        return self.resources / 'flecity_jam'

    def test_initial_plan_and_existing_config_protection(self):
        plan = installer.install(self.archive, self.digest, fixture_resources=self.resources)
        self.assertEqual(plan['status'], 'PLAN')
        self.assertEqual(list(self.resources.iterdir()), [])
        target = self.initial()
        config = target / 'config.lua'
        config.write_text('-- local settings\n', encoding='utf-8')
        with self.assertRaises(FileExistsError):
            installer.install(self.archive, self.digest, True, self.resources)
        self.assertEqual(config.read_text(encoding='utf-8'), '-- local settings\n')

    def test_bad_digest_and_traversal_do_not_install(self):
        with self.assertRaisesRegex(ValueError, 'SHA-256'):
            installer.install(self.archive, '0' * 64, True, self.resources)
        forged = self.base / 'traversal.zip'
        with zipfile.ZipFile(self.archive) as source, zipfile.ZipFile(forged, 'w') as output:
            for name in source.namelist():
                output.writestr(name, source.read(name))
            output.writestr('flecity_jam/../escape.lua', b'bad')
        with self.assertRaises(ValueError):
            installer.install(forged, sha(forged.read_bytes()), True, self.resources)
        self.assertFalse((self.resources / 'flecity_jam').exists())

    def test_qa_document_cannot_enter_distribution(self):
        forged = self.base / 'qa-in-zip.zip'
        with zipfile.ZipFile(self.archive) as source, zipfile.ZipFile(forged, 'w') as output:
            for name in source.namelist():
                if name == 'flecity_jam/MANIFEST.json':
                    manifest = json.loads(source.read(name))
                    manifest['files']['docs/QA_JA.md'] = sha(b'private QA')
                    output.writestr(name, json.dumps(manifest).encode())
                else:
                    output.writestr(name, source.read(name))
            output.writestr('flecity_jam/docs/QA_JA.md', b'private QA')
        with self.assertRaisesRegex(ValueError, 'scope'):
            installer.install(forged, sha(forged.read_bytes()), True, self.resources)
        self.assertFalse((self.resources / 'flecity_jam').exists())

    def test_fixture_cannot_target_real_server(self):
        with self.assertRaisesRegex(ValueError, 'Fixtures'):
            installer.install(self.archive, self.digest, True, installer.RESOURCES)

    def test_package_scope_and_text_bytes(self):
        self.assertTrue(packager.allowed(pathlib.PurePath('docs/INSTALL_JA.md')))
        self.assertFalse(packager.allowed(pathlib.PurePath('docs/QA_JA.md')))
        self.assertFalse(packager.allowed(pathlib.PurePath('tests/install_test.py')))
        text = self.base / 'line.lua'
        text.write_bytes(b'a\r\nb\r\n')
        audio = self.base / 'note.ogg'
        audio.write_bytes(b'\x00\r\n\x01')
        self.assertEqual(packager.package_bytes(text), b'a\nb\n')
        self.assertEqual(packager.package_bytes(audio), b'\x00\r\n\x01')

    def test_pinned_update_backup_and_rollback(self):
        target = self.initial()
        baseline, baseline_sha, original = self.baseline()
        incoming, incoming_sha = self.make_archive('updated', web=b'<html>new</html>')
        plan = installer.update(incoming, incoming_sha, baseline, baseline_sha,
                                fixture_resources=self.resources)
        self.assertEqual(plan['status'], 'PLAN_UPDATE')
        installer.assert_tree(target, original, 'unchanged during plan')
        result = installer.update(incoming, incoming_sha, baseline, baseline_sha,
                                  True, True, self.resources)
        self.assertEqual(result['status'], 'UPDATED')
        installer.assert_tree(pathlib.Path(result['backup']), original, 'full backup')
        self.assertEqual((target / 'config.lua').read_bytes(), b'JamConfig = {}\n')
        self.assertEqual((target / 'web/index.html').read_bytes(), b'<html>new</html>')
        later, later_sha = self.make_archive('later', web=b'<html>later</html>')
        self.assertEqual(installer.update(later, later_sha, result['receipt'],
                                          result['receiptSha256'],
                                          fixture_resources=self.resources)['status'],
                         'PLAN_UPDATE')
        self.assertEqual(installer.rollback(result['receipt'], result['receiptSha256'],
                                            fixture_resources=self.resources)['status'],
                         'PLAN_ROLLBACK')
        restored = installer.rollback(result['receipt'], result['receiptSha256'],
                                      True, True, self.resources)
        self.assertEqual(restored['status'], 'ROLLED_BACK')
        installer.assert_tree(target, original, 'restored JAM')
        installer.assert_tree(pathlib.Path(result['backup']), original, 'retained backup')

    def test_update_conflict_and_config_change_stop_before_writes(self):
        target = self.initial()
        baseline, baseline_sha, original = self.baseline()
        updated, updated_sha = self.make_archive('updated', web=b'<html>new</html>')
        with self.assertRaisesRegex(ValueError, 'CONFLICT_STOP'):
            installer.update(updated, updated_sha, baseline, '0' * 64,
                             True, True, self.resources)
        installer.assert_tree(target, original, 'after bad pin')
        config_zip, config_sha = self.make_archive('new-config', config=b'JamConfig = {Range=9}\n')
        with self.assertRaisesRegex(ValueError, 'CONFLICT_STOP: config.lua'):
            installer.update(config_zip, config_sha, baseline, baseline_sha,
                             True, True, self.resources)
        installer.assert_tree(target, original, 'after config conflict')
        (target / 'web/index.html').write_bytes(b'unexpected change')
        with self.assertRaisesRegex(ValueError, 'CONFLICT_STOP'):
            installer.update(updated, updated_sha, baseline, baseline_sha,
                             True, True, self.resources)

    def test_update_requires_stopped_and_rollback_rejects_drift(self):
        target = self.initial()
        baseline, baseline_sha, original = self.baseline()
        updated, updated_sha = self.make_archive('updated', web=b'<html>new</html>')
        with self.assertRaisesRegex(ValueError, 'confirm JAM is stopped'):
            installer.update(updated, updated_sha, baseline, baseline_sha,
                             True, False, self.resources)
        installer.assert_tree(target, original, 'after stop guard')
        result = installer.update(updated, updated_sha, baseline, baseline_sha,
                                  True, True, self.resources)
        (target / 'web/index.html').write_bytes(b'new local edit')
        with self.assertRaisesRegex(ValueError, 'CONFLICT_STOP'):
            installer.rollback(result['receipt'], result['receiptSha256'],
                               True, True, self.resources)
        installer.assert_tree(pathlib.Path(result['backup']), original, 'safe backup')

    def test_swap_failure_restores_original(self):
        target = self.initial()
        baseline, baseline_sha, original = self.baseline()
        updated, updated_sha = self.make_archive('updated', web=b'<html>new</html>')
        real_rename = pathlib.Path.rename

        def fail_new_swap(path, destination):
            if path.parent.name == 'incoming' and path.name == 'flecity_jam':
                raise OSError('simulated atomic swap failure')
            return real_rename(path, destination)

        with mock.patch.object(pathlib.Path, 'rename', fail_new_swap):
            with self.assertRaisesRegex(OSError, 'simulated atomic swap'):
                installer.update(updated, updated_sha, baseline, baseline_sha,
                                 True, True, self.resources)
        installer.assert_tree(target, original, 'restored after failed swap')


if __name__ == '__main__':
    unittest.main()
