from __future__ import annotations

import hashlib
import os
import re
import shutil
import subprocess
import zipfile
from pathlib import Path

RESOURCE = Path(__file__).resolve().parents[1]
REPO = RESOURCE.parent
DIST = REPO / "dist"
STAGE = DIST / "flecity_games"
RELEASE_VERSION = "1.0.0"
ZIP_NAME = f"flecity-games-loop-{RELEASE_VERSION}.zip"

EXCLUDED_PREFIXES = {
    "tools",
    "release_docs",
    "web/party",
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
    "runtime-active.txt",
    "dev-build.txt",
}


def excluded(rel: Path) -> bool:
    posix = rel.as_posix()
    if posix in EXCLUDED_FILES:
        return True
    return any(posix == prefix or posix.startswith(prefix + "/") for prefix in EXCLUDED_PREFIXES)


def copy_release_tree() -> None:
    if STAGE.exists():
        shutil.rmtree(STAGE)
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
    text = re.sub(r"^description '.+'$", "description 'Flecity Games LOOP - LB Phone mini-game app'", text, flags=re.M)
    text = re.sub(r"^version '.+'$", f"version '{RELEASE_VERSION}'", text, flags=re.M)
    text = text.replace("    'server/core/dev_reload.lua',\n", "")
    path.write_text(text, encoding="utf-8")


def patch_submission_server() -> None:
    path = STAGE / "server/main.lua"
    text = path.read_text(encoding="utf-8")
    marker = "math.randomseed(os.time()+GetGameTimer())"
    marker_index = text.find(marker)
    if marker_index < 0:
        raise RuntimeError("server/main.lua startup marker not found")
    prefix = text[:marker_index]
    if "runtime-active.txt" not in prefix:
        raise RuntimeError("development runtime stamp block not found")
    text = text[marker_index:]
    path.write_text(text, encoding="utf-8")


def patch_submission_config() -> None:
    path = STAGE / "config/shared.lua"
    text = path.read_text(encoding="utf-8")
    start = text.find("        Party = {")
    end_marker = "\n        }\n    },"
    end = text.find(end_marker, start)
    if start < 0 or end < 0:
        raise RuntimeError("Party app config block not found")
    end += len("\n        }")
    block = text[start:end]
    if "enabled = true" not in block or "defaultApp = true" not in block:
        raise RuntimeError("Party app config flags not found")
    block = block.replace("enabled = true", "enabled = false", 1)
    block = block.replace("defaultApp = true", "defaultApp = false", 1)
    text = text[:start] + block + text[end:]
    path.write_text(text, encoding="utf-8")


def add_release_docs() -> None:
    docs = RESOURCE / "release_docs"
    mapping = {
        "INSTALL_JA.txt": "導入方法_運営様向け.txt",
        "OPERATOR_CHECKLIST_JA.txt": "運営確認用メモ.txt",
        "QA_RESULT_JA.txt": "提出前確認結果.txt",
    }
    for source_name, target_name in mapping.items():
        source = docs / source_name
        if not source.is_file():
            raise RuntimeError(f"release document missing: {source}")
        shutil.copy2(source, STAGE / target_name)

    commit = os.environ.get("GITHUB_SHA", "").strip()
    if not commit:
        try:
            commit = subprocess.check_output(
                ["git", "-C", str(REPO), "rev-parse", "HEAD"],
                text=True,
                stderr=subprocess.DEVNULL,
            ).strip()
        except (OSError, subprocess.CalledProcessError):
            commit = "local-build"
    info = (
        f"Flecity Games LOOP {RELEASE_VERSION}\n"
        f"Source commit: {commit}\n"
        "Build type: production submission\n"
        "PARTY custom app: disabled in this submission build\n"
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
        STAGE / "web/play/index.html",
        STAGE / "web/play/app.js",
        STAGE / "web/play/icon.svg",
        STAGE / "sql/001_initial.sql",
        STAGE / "導入方法_運営様向け.txt",
        STAGE / "運営確認用メモ.txt",
        STAGE / "提出前確認結果.txt",
    ]
    missing = [str(path.relative_to(STAGE)) for path in required if not path.is_file()]
    if missing:
        raise RuntimeError("release is missing required files: " + ", ".join(missing))

    if f"version '{RELEASE_VERSION}'" not in manifest or "-test" in manifest:
        raise RuntimeError("release manifest version is not production-safe")
    if "server/core/dev_reload.lua" in manifest:
        raise RuntimeError("development reload script remains in release manifest")
    if (
        (STAGE / "server/core/dev_reload.lua").exists()
        or (STAGE / "tools").exists()
        or (STAGE / "TESTING.md").exists()
        or (STAGE / "runtime-active.txt").exists()
        or (STAGE / "dev-build.txt").exists()
        or (STAGE / "dev-runtime.txt").exists()
    ):
        raise RuntimeError("development-only content remains in release")
    server_main = (STAGE / "server/main.lua").read_text(encoding="utf-8")
    if "runtime-active.txt" in server_main or "dev-build.txt" in server_main:
        raise RuntimeError("development runtime stamp logic remains in release server/main.lua")
    if (STAGE / "web/party").exists():
        raise RuntimeError("PARTY web UI must not be included in LOOP submission")
    if not re.search(r"Party\s*=\s*\{.*?enabled\s*=\s*false.*?defaultApp\s*=\s*false", config, flags=re.S):
        raise RuntimeError("PARTY app is not disabled in submission config")
    if not re.search(r"Play\s*=\s*\{.*?enabled\s*=\s*true.*?name\s*=\s*'LOOP'.*?defaultApp\s*=\s*false.*?game\s*=\s*true.*?price\s*=\s*0", config, flags=re.S):
        raise RuntimeError("LOOP App Store configuration is not submission-safe")


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
    patch_submission_server()
    patch_submission_config()
    add_release_docs()
    validate_release()
    zip_path, digest = make_zip()
    print(f"Submission package: {zip_path}")
    print(f"SHA256: {digest}")


if __name__ == "__main__":
    main()
