"""Pinned JAM install, backup, update and rollback. Never starts a server or edits config."""
import argparse
import hashlib
import json
import os
import pathlib
import shutil
import tempfile
import time
import zipfile

WORKSPACE = pathlib.Path(__file__).resolve().parents[2]
STATE = WORKSPACE / '.flecity-dev' / 'jam'
RESOURCES = pathlib.Path('D:/FiveM_Test_Server/txData/Qbox_D233FD.base/resources')
FIXTURES = STATE / 'install-fixtures'


def no_links(path):
    for part in (path, *path.parents):
        if part.is_symlink() or (hasattr(part, 'is_junction') and part.is_junction()):
            raise ValueError('Linked path is not an install destination: ' + str(part))


def rename_uncontended(source, destination):
    """Allow brief Windows file-indexing locks; never replace an existing path."""
    for attempt in range(5):
        if destination.exists():
            raise FileExistsError('Destination appeared during JAM update')
        try:
            source.rename(destination)
            return
        except PermissionError:
            if attempt == 4:
                raise
            time.sleep(0.1)


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
        if any((i.external_attr >> 16) & 0o170000 == 0o120000 for i in infos):
            raise ValueError('ZIP links are not accepted')
        manifest = json.loads(z.read('flecity_jam/MANIFEST.json'))
        files = manifest['files']
        if not isinstance(files, dict):
            raise ValueError('Invalid ZIP manifest')
        for name in files:
            parts = pathlib.PurePosixPath(name).parts
            if (not parts or parts[0] not in {'client', 'server', 'web', 'licenses',
                                               'docs', 'fxmanifest.lua', 'config.lua',
                                               'README.md'}
                    or parts[0] in {'fxmanifest.lua', 'config.lua', 'README.md'} and len(parts) != 1
                    or parts[0] in {'client', 'server'} and
                    (len(parts) != 2 or pathlib.PurePosixPath(name).suffix != '.lua')
                    or parts[0] == 'web' and
                    not (len(parts) == 2 and (name in {'web/index.html', 'web/catalog.json'}
                                              or pathlib.PurePosixPath(name).suffix in {'.css', '.mjs'})
                         or len(parts) >= 3 and parts[1] == 'samples' and
                         pathlib.PurePosixPath(name).suffix in {'.ogg', '.wav'})
                    or parts[0] == 'licenses' and
                    (len(parts) != 2 or pathlib.PurePosixPath(name).suffix not in {'.txt', '.json'})
                    or parts[0] == 'docs' and
                    (len(parts) != 2 or parts[1] not in {'INSTALL_JA.md', 'MANUAL_JA.md',
                                                         'CONFIG_JA.md', 'SOUNDS_JA.md'})):
                raise ValueError('Unexpected ZIP scope: ' + name)
        if set(names) != {'flecity_jam/' + name for name in files} | {'flecity_jam/MANIFEST.json'}:
            raise ValueError('ZIP inventory mismatch')
        data = {name: z.read('flecity_jam/' + name) for name in files}
        for name, content in data.items():
            if hashlib.sha256(content).hexdigest() != files[name]:
                raise ValueError('Manifest hash mismatch: ' + name)
        runtime = {name: digest for name, digest in files.items()
                   if not name.startswith(('licenses/', 'docs/')) and name != 'README.md'}
        digest = hashlib.sha256(json.dumps(runtime, sort_keys=True,
                                separators=(',', ':')).encode()).hexdigest()
        if digest != manifest.get('runtimeSha256'):
            raise ValueError('Runtime manifest hash mismatch')
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
    staging = resources.parent / 'flecity-jam-staging'
    no_links(staging)
    staging.mkdir(parents=True, exist_ok=True)
    # Stage outside resources on the destination drive; keep failed attempts for inspection.
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
    rename_uncontended(stage, target)
    for name, content in data.items():
        if (target / name).read_bytes() != content:
            raise ValueError('Installed content changed; do not start JAM')
    record.update(status='INSTALLED', version=manifest['version'])
    receipt = staging / ('receipt-' + stage.parent.name + '.json')
    receipt.write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
    return record


def resource_paths(fixture_resources):
    resources = RESOURCES if fixture_resources is None else pathlib.Path(fixture_resources).absolute()
    no_links(resources)
    if fixture_resources is not None and not resources.resolve().is_relative_to(FIXTURES.resolve()):
        raise ValueError('Fixtures must stay in the JAM test directory')
    if not resources.is_dir():
        raise ValueError('Expected resources directory is absent')
    return resources, resources / 'flecity_jam', resources.parent / 'flecity-jam-backups'


def file_map(data):
    return {name: dict(sha256=hashlib.sha256(content).hexdigest(), bytes=len(content))
            for name, content in data.items()}


def baseline_files(path, expected_sha256):
    raw = pathlib.Path(path).read_bytes()
    if hashlib.sha256(raw).hexdigest() != expected_sha256.lower():
        raise ValueError('CONFLICT_STOP: baseline manifest SHA-256 mismatch')
    document = json.loads(raw)
    rows = document.get('files', document.get('afterManifest'))
    if isinstance(rows, dict):
        rows = [dict(path=name, **details) for name, details in rows.items()]
    if not isinstance(rows, list) or len(rows) > 256:
        raise ValueError('Invalid baseline file list')
    files = {}
    for row in rows:
        name = row['path']
        digest = row['sha256'].lower()
        if (not isinstance(name, str) or not name or '\\' in name or ':' in name
                or any(part in ('', '.', '..') or part.endswith(('.', ' '))
                       for part in name.split('/'))
                or not isinstance(digest, str) or len(digest) != 64
                or any(c not in '0123456789abcdef' for c in digest)
                or name.casefold() in (key.casefold() for key in files)):
            raise ValueError('Invalid baseline entry')
        files[name] = dict(sha256=digest, bytes=int(row['bytes']))
        if files[name]['bytes'] < 0:
            raise ValueError('Invalid baseline file size')
    return files


def assert_tree(target, expected, label):
    no_links(target)
    if not target.is_dir():
        raise ValueError('CONFLICT_STOP: ' + label + ' is absent')
    actual = {}
    for path in target.rglob('*'):
        if path.is_symlink() or (hasattr(path, 'is_junction') and path.is_junction()):
            raise ValueError('CONFLICT_STOP: linked ' + label + ' entry')
        if path.is_file():
            name = path.relative_to(target).as_posix()
            actual[name] = dict(sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                                bytes=path.stat().st_size)
    if actual != expected:
        raise ValueError('CONFLICT_STOP: ' + label + ' differs from pinned manifest')


def write_tree(target, data):
    target.mkdir(parents=True)
    for name, content in data.items():
        output = target / pathlib.PurePosixPath(name)
        if not output.resolve().is_relative_to(target.resolve()):
            raise ValueError('Staging path escape')
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(content)


def update(archive, expected_sha256, baseline, baseline_sha256,
           apply=False, confirmed_stopped=False, fixture_resources=None,
           reviewed_config_sha256=None):
    """Replace only a pinned JAM tree, retaining two verified full backups."""
    resources, target, backups = resource_paths(fixture_resources)
    no_links(target)
    no_links(backups)
    previous = baseline_files(baseline, baseline_sha256)
    incoming, manifest = verified_archive(pathlib.Path(archive), expected_sha256)
    assert_tree(target, previous, 'installed JAM')
    before_config = hashlib.sha256((target / 'config.lua').read_bytes()).hexdigest()
    after_config = hashlib.sha256(incoming['config.lua']).hexdigest()
    if (reviewed_config_sha256 is not None
            and (not isinstance(reviewed_config_sha256, str)
                 or reviewed_config_sha256.lower() != after_config)):
        raise ValueError('CONFLICT_STOP: reviewed config.lua SHA-256 mismatch')
    if before_config != after_config and reviewed_config_sha256 is None:
        raise ValueError('CONFLICT_STOP: config.lua requires explicit settings review')
    record = dict(status='PLAN_UPDATE', target=str(target), beforeFiles=len(previous),
                  afterFiles=len(incoming), archiveSha256=expected_sha256,
                  baselineSha256=baseline_sha256, serverStarted=False,
                  otherResourcesChanged=False,
                  configReview=dict(beforeSha256=before_config, afterSha256=after_config,
                                    changed=before_config != after_config,
                                    explicitPin=reviewed_config_sha256 is not None))
    if not apply:
        return record
    if not confirmed_stopped:
        raise ValueError('CONFLICT_STOP: confirm JAM is stopped before update')
    if os.name != 'nt':
        raise ValueError('Update is limited to the inspected Windows environment')
    backups.mkdir(parents=True, exist_ok=True)
    session = pathlib.Path(tempfile.mkdtemp(prefix='jam-update-', dir=backups))
    backup = session / 'before' / 'flecity_jam'
    backup.parent.mkdir()
    shutil.copytree(target, backup)
    assert_tree(backup, previous, 'pre-update backup')
    staged = session / 'incoming' / 'flecity_jam'
    staged.parent.mkdir()
    write_tree(staged, incoming)
    next_files = file_map(incoming)
    assert_tree(staged, next_files, 'staged JAM')
    assert_tree(target, previous, 'installed JAM before swap')
    receipt = session / 'receipt.json'
    record.update(status='PREPARED', version=manifest['version'],
                  backup=str(backup), receipt=str(receipt),
                  beforeManifest=previous, afterManifest=next_files)
    receipt.write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
    held = session / 'held-original' / 'flecity_jam'
    held.parent.mkdir()
    rename_uncontended(target, held)
    try:
        rename_uncontended(staged, target)
        assert_tree(target, next_files, 'updated JAM')
    except Exception:
        if target.exists():
            failed = session / 'failed-update' / 'flecity_jam'
            failed.parent.mkdir(exist_ok=True)
            rename_uncontended(target, failed)
        rename_uncontended(held, target)
        raise
    return dict(status='UPDATED', target=str(target), backup=str(backup),
                receipt=str(receipt), receiptSha256=hashlib.sha256(receipt.read_bytes()).hexdigest(),
                beforeFiles=len(previous), afterFiles=len(next_files),
                serverStarted=False, otherResourcesChanged=False)


def rollback(receipt_path, receipt_sha256, apply=False,
             confirmed_stopped=False, fixture_resources=None):
    """Restore the exact pinned pre-update tree; retain the backup and failed version."""
    resources, target, backups = resource_paths(fixture_resources)
    receipt = pathlib.Path(receipt_path).absolute()
    no_links(receipt)
    if not receipt.resolve().is_relative_to(backups.resolve()):
        raise ValueError('CONFLICT_STOP: receipt outside JAM backup directory')
    if hashlib.sha256(receipt.read_bytes()).hexdigest() != receipt_sha256.lower():
        raise ValueError('CONFLICT_STOP: receipt SHA-256 mismatch')
    record = json.loads(receipt.read_text(encoding='utf-8'))
    backup = pathlib.Path(record['backup'])
    if (pathlib.Path(record['target']).resolve() != target.resolve()
            or not backup.resolve().is_relative_to(backups.resolve())):
        raise ValueError('CONFLICT_STOP: receipt target or backup mismatch')
    before, after = record['beforeManifest'], record['afterManifest']
    assert_tree(target, after, 'current JAM before rollback')
    assert_tree(backup, before, 'rollback backup')
    result = dict(status='PLAN_ROLLBACK', target=str(target),
                  restoredFiles=len(before), serverStarted=False)
    if not apply:
        return result
    if not confirmed_stopped:
        raise ValueError('CONFLICT_STOP: confirm JAM is stopped before rollback')
    if os.name != 'nt':
        raise ValueError('Rollback is limited to the inspected Windows environment')
    session = pathlib.Path(tempfile.mkdtemp(prefix='jam-rollback-', dir=backups))
    staged = session / 'restore' / 'flecity_jam'
    staged.parent.mkdir()
    shutil.copytree(backup, staged)
    assert_tree(staged, before, 'staged rollback')
    assert_tree(target, after, 'current JAM before rollback swap')
    held = session / 'replaced' / 'flecity_jam'
    held.parent.mkdir()
    rename_uncontended(target, held)
    try:
        rename_uncontended(staged, target)
        assert_tree(target, before, 'restored JAM')
    except Exception:
        if target.exists():
            failed = session / 'failed-rollback' / 'flecity_jam'
            failed.parent.mkdir(exist_ok=True)
            rename_uncontended(target, failed)
        rename_uncontended(held, target)
        raise
    result.update(status='ROLLED_BACK', replaced=str(held), backup=str(backup))
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--confirmed-stopped', action='store_true')
    parser.add_argument('--fixture-resources', type=pathlib.Path)
    action = parser.add_mutually_exclusive_group()
    action.add_argument('--update', action='store_true')
    action.add_argument('--rollback', type=pathlib.Path)
    parser.add_argument('--baseline', type=pathlib.Path)
    parser.add_argument('--baseline-sha256')
    parser.add_argument('--receipt-sha256')
    parser.add_argument('--reviewed-config-sha256',
                        help='Explicitly reviewed incoming config.lua SHA-256; update only')
    args = parser.parse_args()
    try:
        if args.reviewed_config_sha256 is not None and not args.update:
            raise ValueError('CONFLICT_STOP: reviewed config pin requires --update')
        if args.rollback:
            if not args.receipt_sha256:
                raise ValueError('CONFLICT_STOP: --receipt-sha256 is required')
            result = rollback(args.rollback, args.receipt_sha256, args.apply,
                              args.confirmed_stopped, args.fixture_resources)
        else:
            package = json.loads((STATE / 'dist' / 'package-result.json').read_text(encoding='utf-8'))
            if args.update:
                if not args.baseline or not args.baseline_sha256:
                    raise ValueError('CONFLICT_STOP: pinned baseline and SHA-256 are required')
                result = update(pathlib.Path(package['file']), package['sha256'],
                                args.baseline, args.baseline_sha256, args.apply,
                                args.confirmed_stopped, args.fixture_resources,
                                args.reviewed_config_sha256)
            else:
                result = install(pathlib.Path(package['file']), package['sha256'],
                                 args.apply, args.fixture_resources)
        print(json.dumps(result, ensure_ascii=False))
    except (OSError, ValueError, KeyError, zipfile.BadZipFile) as error:
        print(json.dumps(dict(status='BLOCKED', error=str(error), liveFiveM='NOT_RUN'), ensure_ascii=False))
        raise SystemExit(1)
