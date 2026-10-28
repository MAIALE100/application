#!/usr/bin/env python3
"""Verify the SHA-pinned WAVE base -> v0.2.2 -> v0.3.0 -> atomic patch chain.

Only uses a temporary directory; never touches a running FiveM resource.
"""
import base64
import gzip
import hashlib
import io
from pathlib import Path
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent
BASE_PARTS = [f'wave-package.part{i:02d}' for i in range(7)] + [f'wave-package.part07{c}' for c in 'abcdefg'] + ['wave-package.part08']
APP_PARTS = [f'wave-v022-app.part{i:02d}' for i in range(3)]
PATCH_PARTS = [f'wave-v030-patchb64.part{i:02d}' for i in range(6)]
PINS = {
    'base': '34a84f4575f09ced45a58ef390272f9794f4d7cdcc548024a48fe5f899e16850',
    'app': '1ce2c985ab072db4f1c2b9c3d2194525ef619ff8456b154ae2de18f513602262',
    'v030': '6a91d4cdefa0332119d00a1f72b6e3fda0e54edbf4564a716ddf0dc9ac65fafe',
    'atomic': 'c722057b935c55593f29ee574ff2bf68ac2b02ea4e8895230c8f0dd6c5f66609',
}


def verify(data, key):
    actual = hashlib.sha256(data).hexdigest()
    if actual != PINS[key]:
        raise AssertionError(f'{key} SHA256 mismatch: {actual}')
    return data


def encoded(parts):
    return base64.b64decode(''.join((ROOT / p).read_text(encoding='ascii').strip() for p in parts), validate=True)


def apply_patch(wave, patch_path, name):
    for args in (['--check'], []):
        proc = subprocess.run(['git', 'apply', '--whitespace=nowarn', *args, str(patch_path)], cwd=wave, text=True, capture_output=True)
        if proc.returncode:
            server = (wave / 'server/main.lua').read_text(encoding='utf-8')
            at = server.find('local function cbUpdateOwnTrack')
            context = server[at:at+2500] if at >= 0 else 'cbUpdateOwnTrack not found'
            raise AssertionError(f'{name} git apply {args} failed:\\n{proc.stderr}\\nCurrent owner-action context:\\n{context}')


def main():
    with tempfile.TemporaryDirectory(prefix='wave-patch-chain-') as tmp:
        temp = Path(tmp)
        zip_data = verify(encoded(BASE_PARTS), 'base')
        with zipfile.ZipFile(io.BytesIO(zip_data)) as archive:
            for member in archive.infolist():
                target = (temp / member.filename).resolve()
                if not target.is_relative_to(temp.resolve()):
                    raise AssertionError(f'Unsafe ZIP path: {member.filename}')
            archive.extractall(temp)
        wave = temp / 'wave'
        app = verify(gzip.decompress(encoded(APP_PARTS)), 'app')
        (wave / 'web/app.js').write_bytes(app)
        manifest = wave / 'fxmanifest.lua'
        content = manifest.read_text(encoding='utf-8')
        assert content.count("version '0.2.0-test'") == 1
        manifest.write_text(content.replace("version '0.2.0-test'", "version '0.2.2-test'"), encoding='utf-8')

        raw_patch = verify(encoded(PATCH_PARTS), 'v030')
        patch_text = raw_patch.decode('utf-8')
        wrong = '.album-public-chip spanp{'
        assert patch_text.count(wrong) == 2, 'Historical CSS correction drifted'
        patch = temp / 'wave-v030.patch'
        patch.write_text(patch_text.replace(wrong, '.album-public-chip span{'), encoding='utf-8')
        apply_patch(wave, patch, 'v0.3.0')

        atomic = verify((ROOT / 'wave-v030-atomic-status.patch').read_bytes(), 'atomic')
        atomic_file = temp / 'wave-atomic.patch'
        atomic_file.write_bytes(atomic)
        apply_patch(wave, atomic_file, 'atomic release-state')
        server = (wave / 'server/main.lua').read_text(encoding='utf-8')
        js = (wave / 'web/app.js').read_text(encoding='utf-8')
        assert 'Atomic status predicates' in server
        assert "AND status='public'" in server
        assert 'ERROR_TEXT.TRACK_STATE_CHANGED' in js
        print('WAVE base/v0.2.2/v0.3.0/atomic patch compatibility: PASS')


if __name__ == '__main__':
    main()
