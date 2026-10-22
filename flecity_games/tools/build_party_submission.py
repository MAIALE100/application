from __future__ import annotations

import hashlib
import os
import re
import shutil
import zipfile
from pathlib import Path

RESOURCE = Path(__file__).resolve().parents[1]
REPO = RESOURCE.parent
DIST = REPO / "dist"
STAGE_ROOT = DIST / "party-submission-stage"
STAGE = STAGE_ROOT / "flecity_games"
PARTY_RELEASE_VERSION = "1.0.0"
RESOURCE_RELEASE_VERSION = "1.1.0"
ZIP_NAME = f"flecity-games-party-{PARTY_RELEASE_VERSION}.zip"

EXCLUDED_PREFIXES = {
    "tools",
    "release_docs",
}
EXCLUDED_FILES = {
    "README.md",
    "INSTALL.md",
    "TESTING.md",
    "server/core/dev_reload.lua",
    "web/play/icon.png",
    "dev-auto-reload.enabled",
    "dev-reload.token",
    "dev-reload-v2.active",
    "dev-runtime.txt",
    "dev-build.txt",
}


def excluded(rel: Path) -> bool:
    posix = rel.as_posix()
    if posix in EXCLUDED_FILES:
        return True
    return any(posix == prefix or posix.startswith(prefix + "/") for prefix in EXCLUDED_PREFIXES)


def copy_release_tree() -> None:
    if STAGE_ROOT.exists():
        shutil.rmtree(STAGE_ROOT)
    STAGE.mkdir(parents=True, exist_ok=True)
    for source in sorted(RESOURCE.rglob("*")):
        rel = source.relative_to(RESOURCE)
        if excluded(rel):
            continue
        target = STAGE / rel
        if source.is_dir():
            target.mkdir(parents=True, exist_ok=True)
        elif source.is_file():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)


def patch_manifest() -> None:
    path = STAGE / "fxmanifest.lua"
    text = path.read_text(encoding="utf-8")
    text = re.sub(r"^description '.+'$", "description 'Flecity Games LOOP + PARTY - LB Phone game apps'", text, flags=re.M)
    text = re.sub(r"^version '.+'$", f"version '{RESOURCE_RELEASE_VERSION}'", text, flags=re.M)
    text = text.replace("    'server/core/dev_reload.lua',\n", "")
    path.write_text(text, encoding="utf-8")


def add_release_docs() -> None:
    docs = RESOURCE / "release_docs"
    mapping = {
        "PARTY_INSTALL_JA.txt": "PARTY_導入方法_運営様向け.txt",
        "PARTY_OPERATOR_CHECKLIST_JA.txt": "PARTY_運営確認用メモ.txt",
    }
    for source_name, target_name in mapping.items():
        source = docs / source_name
        if not source.is_file():
            raise RuntimeError(f"release document missing: {source}")
        shutil.copy2(source, STAGE / target_name)

    commit = os.environ.get("GITHUB_SHA", "local-build")
    info = (
        f"Flecity Games PARTY {PARTY_RELEASE_VERSION}\n"
        f"Resource version: {RESOURCE_RELEASE_VERSION}\n"
        f"Source commit: {commit}\n"
        "Build type: production submission\n"
        "LOOP: enabled, existing App Store specification retained\n"
        "PARTY: enabled, App Store free download\n"
        "Development auto-reload/tools: excluded\n"
    )
    (STAGE / "BUILD_INFO.txt").write_text(info, encoding="utf-8")


def validate_release() -> None:
    manifest = (STAGE / "fxmanifest.lua").read_text(encoding="utf-8")
    config = (STAGE / "config/shared.lua").read_text(encoding="utf-8")

    required = [
        STAGE / "fxmanifest.lua",
        STAGE / "client/main.lua",
        STAGE / "server/main.lua",
        STAGE / "server/core/play.lua",
        STAGE / "server/core/party.lua",
        STAGE / "web/play/index.html",
        STAGE / "web/play/app.js",
        STAGE / "web/play/icon.svg",
        STAGE / "web/party/index.html",
        STAGE / "web/party/app.js",
        STAGE / "web/party/icon.svg",
        STAGE / "sql/001_initial.sql",
        STAGE / "PARTY_導入方法_運営様向け.txt",
        STAGE / "PARTY_運営確認用メモ.txt",
    ]
    missing = [str(path.relative_to(STAGE)) for path in required if not path.is_file()]
    if missing:
        raise RuntimeError("release is missing required files: " + ", ".join(missing))

    if f"version '{RESOURCE_RELEASE_VERSION}'" not in manifest or "-test" in manifest:
        raise RuntimeError("release manifest version is not production-safe")
    if "server/core/dev_reload.lua" in manifest:
        raise RuntimeError("development reload script remains in release manifest")
    if (STAGE / "server/core/dev_reload.lua").exists() or (STAGE / "tools").exists() or (STAGE / "TESTING.md").exists():
        raise RuntimeError("development-only content remains in PARTY release")

    play_pattern = r"Play\s*=\s*\{.*?enabled\s*=\s*true.*?identifier\s*=\s*'flecity_play'.*?name\s*=\s*'LOOP'.*?defaultApp\s*=\s*false.*?game\s*=\s*true.*?price\s*=\s*0"
    party_pattern = r"Party\s*=\s*\{.*?enabled\s*=\s*true.*?identifier\s*=\s*'flecity_party'.*?name\s*=\s*'PARTY'.*?defaultApp\s*=\s*false.*?game\s*=\s*true.*?price\s*=\s*0"
    if not re.search(play_pattern, config, flags=re.S):
        raise RuntimeError("LOOP App Store configuration changed unexpectedly")
    if not re.search(party_pattern, config, flags=re.S):
        raise RuntimeError("PARTY App Store configuration is not release-safe")


def make_zip() -> tuple[Path, str]:
    zip_path = DIST / ZIP_NAME
    if zip_path.exists():
        zip_path.unlink()
    files = sorted(path for path in STAGE.rglob("*") if path.is_file())
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in files:
            arcname = (Path("flecity_games") / path.relative_to(STAGE)).as_posix()
            archive.write(path, arcname)

    digest = hashlib.sha256(zip_path.read_bytes()).hexdigest()
    checksum = DIST / f"{ZIP_NAME}.sha256"
    checksum.write_text(f"{digest}  {ZIP_NAME}\n", encoding="ascii")
    return zip_path, digest


def main() -> None:
    DIST.mkdir(parents=True, exist_ok=True)
    copy_release_tree()
    patch_manifest()
    add_release_docs()
    validate_release()
    zip_path, digest = make_zip()
    print(f"PARTY submission package: {zip_path}")
    print(f"SHA256: {digest}")


if __name__ == "__main__":
    main()
