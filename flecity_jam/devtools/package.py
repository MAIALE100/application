"""Build a deterministic JAM runtime ZIP. Never deploy or modify a server."""

import hashlib
import json
import pathlib
import re
import subprocess
import zipfile


ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT.parent / '.flecity-dev' / 'jam' / 'dist'
RUNTIME_ROOT = {'fxmanifest.lua', 'config.lua', 'README.md'}
PUBLIC_DOCS = {'INSTALL_JA.md', 'MANUAL_JA.md', 'CONFIG_JA.md', 'SOUNDS_JA.md'}
WEB_ROOT = {'index.html', 'catalog.json'}
WEB_EXT = {'.css', '.mjs'}
AUDIO_EXT = {'.ogg', '.wav'}
LICENSE_EXT = {'.txt', '.json'}
TEXT_EXT = {'.lua', '.mjs', '.css', '.html', '.json', '.md', '.txt'}


def allowed(relative):
    parts = relative.parts
    if any(part.startswith('.') or part in {'tests', 'devtools', 'QA', '__pycache__'} for part in parts):
        return False
    if len(parts) == 1:
        return relative.name in RUNTIME_ROOT
    if parts[0] in {'client', 'server'}:
        return len(parts) == 2 and relative.suffix == '.lua'
    if parts[0] == 'web':
        if len(parts) == 2:
            return relative.name in WEB_ROOT or relative.suffix in WEB_EXT
        return len(parts) >= 3 and parts[1] == 'samples' and relative.suffix in AUDIO_EXT
    if parts[0] == 'licenses':
        return len(parts) == 2 and relative.suffix in LICENSE_EXT
    if parts[0] == 'docs':
        return len(parts) == 2 and relative.name in PUBLIC_DOCS
    return False


def entries():
    paths = []
    for part in ('client', 'server', 'web', 'licenses', 'docs'):
        folder = ROOT / part
        if not folder.is_dir():
            raise ValueError(f'Missing package directory: {part}')
        for path in folder.rglob('*'):
            if path.is_symlink() or (hasattr(path, 'is_junction') and path.is_junction()):
                raise ValueError(f'Linked package entry: {path}')
            if path.is_file():
                relative = path.relative_to(ROOT)
                if part == 'docs' and relative.name not in PUBLIC_DOCS:
                    continue
                if '__pycache__' in relative.parts or path.suffix == '.pyc':
                    continue
                if not allowed(relative):
                    raise ValueError(f'Unexpected package entry: {relative}')
                paths.append(path)
    paths.extend(ROOT / name for name in sorted(RUNTIME_ROOT))
    if any(not path.is_file() or path.is_symlink() for path in paths):
        raise ValueError('Missing or linked required runtime file')
    names = {path.relative_to(ROOT).as_posix() for path in paths}
    required = {'fxmanifest.lua', 'config.lua', 'client/main.lua',
                'server/main.lua', 'web/index.html', 'web/catalog.json',
                'licenses/sample-provenance.json', 'README.md',
                *(f'docs/{name}' for name in PUBLIC_DOCS)}
    if not required.issubset(names):
        raise ValueError('Missing required runtime or provenance file')
    return sorted(paths, key=lambda path: path.relative_to(ROOT).as_posix())


def version():
    text = (ROOT / 'fxmanifest.lua').read_text(encoding='utf-8')
    match = re.search(r"(?m)^\s*version\s+['\"]([^'\"]+)['\"]", text)
    if not match or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,32}', match.group(1)):
        raise ValueError('Missing or unsafe fxmanifest version')
    return match.group(1)


def package_bytes(path):
    content = path.read_bytes()
    if path.suffix in TEXT_EXT:
        return content.replace(b'\r\n', b'\n').replace(b'\r', b'\n')
    return content


def write_zip(archive, files, manifest):
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED,
                         compresslevel=9) as output:
        for name, content in [*files.items(), ('MANIFEST.json', manifest)]:
            item = zipfile.ZipInfo('flecity_jam/' + name,
                                   date_time=(1980, 1, 1, 0, 0, 0))
            item.compress_type = zipfile.ZIP_DEFLATED
            item.external_attr = 0o644 << 16
            output.writestr(item, content, compress_type=zipfile.ZIP_DEFLATED,
                            compresslevel=9)


def build():
    OUT.mkdir(parents=True, exist_ok=True)
    source = {path.relative_to(ROOT).as_posix(): package_bytes(path)
              for path in entries()}
    hashes = {name: hashlib.sha256(content).hexdigest()
              for name, content in source.items()}
    runtime = {name: digest for name, digest in hashes.items()
               if not name.startswith(('licenses/', 'docs/')) and name != 'README.md'}
    runtime_hash = hashlib.sha256(json.dumps(runtime, sort_keys=True,
                                separators=(',', ':')).encode()).hexdigest()
    current_version = version()
    # Record the exact source revision without requiring Git on operator machines.
    try:
        commit = subprocess.run(['git', '-C', str(ROOT), 'rev-parse', 'HEAD'],
                                capture_output=True, text=True, check=True).stdout.strip()
        dirty = bool(subprocess.run(['git', '-C', str(ROOT), 'status', '--porcelain', '--', '.'],
                                   capture_output=True, text=True, check=True).stdout.strip())
    except (OSError, subprocess.CalledProcessError):
        commit, dirty = None, None
    manifest = (json.dumps(dict(version=current_version, releaseReady=False,
                 liveFiveM='SEE_EXTERNAL_QA', sourceCommit=commit, sourceDirty=dirty,
                 runtimeSha256=runtime_hash, files=hashes),
                 ensure_ascii=False, sort_keys=True, indent=2) + '\n').encode()
    artifact = OUT / ('Flecity_JAM_' + current_version.replace('-', '_') + '.zip')
    write_zip(artifact, source, manifest)
    with zipfile.ZipFile(artifact) as check:
        if check.testzip() is not None or len(check.namelist()) != len(source) + 1:
            raise ValueError('ZIP integrity check failed')
        if any(not name.startswith('flecity_jam/') or '/tests/' in name
               or '/devtools/' in name or '/QA/' in name
               for name in check.namelist()):
            raise ValueError('ZIP scope check failed')
        for name, digest in hashes.items():
            if hashlib.sha256(check.read('flecity_jam/' + name)).hexdigest() != digest:
                raise ValueError(f'ZIP file hash mismatch: {name}')
    digest = hashlib.sha256(artifact.read_bytes()).hexdigest()
    (OUT / 'SHA256SUMS.txt').write_text(f'{digest}  {artifact.name}\n', 'utf-8')
    result = dict(file=str(artifact), bytes=artifact.stat().st_size,
                  sha256=digest, files=len(source) + 1,
                  runtimeSha256=runtime_hash, status='PASS', releaseReady=False)
    (OUT / 'package-result.json').write_text(json.dumps(result, indent=2) + '\n',
                                             'utf-8')
    return result


if __name__ == '__main__':
    print(json.dumps(build()))
