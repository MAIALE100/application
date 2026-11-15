"""Verified initial install only. No server start, config edit, overwrite or deletion."""
import argparse
import hashlib
import json
import os
import pathlib
import tempfile
import zipfile

WORKSPACE = pathlib.Path(__file__).resolve().parents[2]
STATE = WORKSPACE / '.flecity-dev' / 'jam'
RESOURCES = pathlib.Path('D:/FiveM_Test_Server/txData/Qbox_D233FD.base/resources')
FIXTURES = STATE / 'install-fixtures'


def no_links(path):
    for part in (path, *path.parents):
        if part.is_symlink() or (hasattr(part, 'is_junction') and part.is_junction()):
            raise ValueError('Linked path is not an install destination: ' + str(part))


def verified_archive(archive, expected):
    raw = archive.read_bytes()
    if hashlib.sha256(raw).hexdigest() != expected.lower():
        raise ValueError('ZIP SHA-256 mismatch')
    with zipfile.ZipFile(archive) as z:
        infos = z.infolist()
        if len(infos) > 256 or sum(i.file_size for i in infos) > 64 * 1024 * 1024:
            raise ValueError('Unexpected archive size')
        names = [i.filename for i in infos]
        if len(names) != len(set(n.casefold() for n in names)):
            raise ValueError('Duplicate ZIP path')
        for name in names:
            p = pathlib.PurePosixPath(name)
            if (not name.startswith('flecity_jam/') or '\\' in name or ':' in name
                    or any(c in ('', '.', '..') or c.endswith(('.', ' ')) for c in name.split('/'))):
                raise ValueError('Unsafe ZIP path: ' + name)
        manifest = json.loads(z.read('flecity_jam/MANIFEST.json'))
        files = manifest['files']
        if set(names) != {'flecity_jam/' + name for name in files} | {'flecity_jam/MANIFEST.json'}:
            raise ValueError('ZIP inventory mismatch')
        data = {name: z.read('flecity_jam/' + name) for name in files}
        for name, content in data.items():
            if hashlib.sha256(content).hexdigest() != files[name]:
                raise ValueError('Manifest hash mismatch: ' + name)
        required = {'fxmanifest.lua', 'config.lua', 'web/index.html', 'server/main.lua', 'client/main.lua'}
        if not required.issubset(files):
            raise ValueError('Missing required runtime files')
        data['MANIFEST.json'] = z.read('flecity_jam/MANIFEST.json')
        return data, manifest


def install(archive, expected, apply=False, fixture_resources=None):
    no_links(STATE)
    resources = RESOURCES if fixture_resources is None else pathlib.Path(fixture_resources).absolute()
    no_links(resources)
    if fixture_resources is not None and not resources.resolve().is_relative_to(FIXTURES.resolve()):
        raise ValueError('Fixtures must stay in the JAM test directory')
    if not resources.is_dir():
        raise ValueError('Expected resources directory is absent')
    target = resources / 'flecity_jam'
    no_links(target)
    if target.exists():
        raise FileExistsError('JAM already exists; initial installer will not overwrite it')
    data, manifest = verified_archive(pathlib.Path(archive), expected)
    record = dict(status='PLAN', target=str(target), files=len(data), sha256=expected,
                  liveFiveM='NOT_RUN', serverStarted=False, serverSettingsChanged=False)
    if not apply:
        return record
    if os.name != 'nt':
        raise ValueError('Install is limited to the inspected Windows environment')
    staging = STATE / 'install-staging'
    no_links(staging)
    staging.mkdir(parents=True, exist_ok=True)
    # A unique workspace directory keeps failed attempts intact for inspection.
    stage = pathlib.Path(tempfile.mkdtemp(prefix='jam-', dir=staging)) / 'flecity_jam'
    stage.mkdir()
    for name, content in data.items():
        output = stage / pathlib.PurePosixPath(name)
        if not output.resolve().is_relative_to(stage.resolve()):
            raise ValueError('Staging path escape')
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(content)
    for name, content in data.items():
        if (stage / name).read_bytes() != content:
            raise ValueError('Staging changed during preparation')
    no_links(resources)
    no_links(target)
    if target.exists():
        raise FileExistsError('JAM appeared during preparation; no overwrite attempted')
    if stage.drive.casefold() != target.drive.casefold():
        raise ValueError('Atomic initial install requires the same Windows drive')
    # Windows rename fails if the destination exists, including a concurrent install.
    stage.rename(target)
    for name, content in data.items():
        if (target / name).read_bytes() != content:
            raise ValueError('Installed content changed; do not start JAM')
    record.update(status='INSTALLED', version=manifest['version'])
    receipt = staging / ('receipt-' + stage.parent.name + '.json')
    receipt.write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
    return record


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--fixture-resources', type=pathlib.Path)
    args = parser.parse_args()
    package = json.loads((STATE / 'dist' / 'package-result.json').read_text(encoding='utf-8'))
    try:
        print(json.dumps(install(pathlib.Path(package['file']), package['sha256'], args.apply,
                                 args.fixture_resources), ensure_ascii=False))
    except (OSError, ValueError, KeyError, zipfile.BadZipFile) as error:
        print(json.dumps(dict(status='BLOCKED', error=str(error), liveFiveM='NOT_RUN'), ensure_ascii=False))
        raise SystemExit(1)
