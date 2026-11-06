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
LINK_RELEASE_VERSION = "1.0.0"
RESOURCE_RELEASE_VERSION = "1.1.0"


def source_commit() -> str:
    try:
        dirty = subprocess.check_output(
            ["git", "-C", str(REPO), "status", "--porcelain", "--untracked-files=no"],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
        if dirty:
            raise RuntimeError(
                "release candidate build requires a clean tracked worktree; commit or review tracked changes first"
            )
        env_commit = os.environ.get("GITHUB_SHA", "").strip()
        if env_commit:
            return env_commit
        return subprocess.check_output(
            ["git", "-C", str(REPO), "rev-parse", "HEAD"],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except RuntimeError:
        raise
    except Exception as error:
        raise RuntimeError(f"could not determine a clean source commit: {error}") from error


BUILD_SOURCE_COMMIT = source_commit()
BUILD_ID = BUILD_SOURCE_COMMIT[:12]
STAGE_ROOT = DIST / f"link-submission-stage-{BUILD_ID}"
STAGE = STAGE_ROOT / "flecity_games"
ZIP_NAME = f"flecity-games-loop-link-{LINK_RELEASE_VERSION}-{BUILD_ID}.zip"
SUBMISSION_MESSAGE_NAME = f"LINK_運営提出文-{BUILD_ID}.txt"

EXCLUDED_PREFIXES = {"tools", "release_docs"}
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
    if STAGE_ROOT.exists():
        raise RuntimeError(
            f"staging directory already exists; preserve it and inspect first: {STAGE_ROOT}"
        )
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
    text = re.sub(
        r"^description '.+'\r?$",
        "description 'Flecity Games LOOP + LINK - LB Phone game apps'",
        text,
        flags=re.M,
    )
    text = re.sub(
        r"^version '.+'\r?$",
        f"version '{RESOURCE_RELEASE_VERSION}'",
        text,
        flags=re.M,
    )
    text = re.sub(r"^\s*'server/core/dev_reload\.lua',\r?\n", "", text, flags=re.M)
    path.write_text(text, encoding="utf-8", newline="\n")


def patch_server_main() -> None:
    path = STAGE / "server/main.lua"
    text = path.read_text(encoding="utf-8")
    text, build_commit_count = re.subn(
        r"local buildCommit=FlecityGamesText\.Normalize\(LoadResourceFile\(GetCurrentResourceName\(\),'dev-build\.txt'\) or ''\)\r?\n\s*if buildCommit=='' then buildCommit='packaged' end",
        "local buildCommit='packaged'",
        text,
    )
    if build_commit_count != 1:
        raise RuntimeError(f"expected one development build marker in startup diagnostics, found {build_commit_count}")
    text, status_build_count = re.subn(
        r"local build=FlecityGamesText\.Normalize\(LoadResourceFile\(GetCurrentResourceName\(\),'dev-build\.txt'\) or ''\)\r?\n\s*if build=='' then build='packaged' end",
        "local build='packaged'",
        text,
    )
    if status_build_count != 1:
        raise RuntimeError(f"expected one development build marker in game_status, found {status_build_count}")
    runtime_marker = re.compile(
        r"local startupOk=startupDiagnostics\(\)\r?\n\s*if startupOk then\r?\n"
        r"\s*local runtimeMarker=\('version=%s\\nbuild=%s\\nstarted=%s\\n'\):format\(\r?\n"
        r"\s*gamesVersion,\r?\n\s*buildCommit,\r?\n\s*os\.date\('!%Y-%m-%dT%H:%M:%SZ'\)\r?\n\s*\)\r?\n"
        r"\s*SaveResourceFile\(GetCurrentResourceName\(\),'runtime-active\.txt',runtimeMarker,-1\)\r?\n\s*end"
    )
    text, runtime_marker_count = runtime_marker.subn("startupDiagnostics()", text)
    if runtime_marker_count != 1:
        raise RuntimeError(f"expected one runtime marker writer to remove from package, found {runtime_marker_count}")
    path.write_text(text, encoding="utf-8", newline="\n")


def add_release_docs() -> None:
    docs = RESOURCE / "release_docs"
    mapping = {
        "PARTY_INSTALL_JA.txt": "LINK_導入方法_運営様向け.txt",
        "PARTY_OPERATOR_CHECKLIST_JA.txt": "LINK_運営確認用メモ.txt",
        "PARTY_QA_RESULT_JA.txt": "LINK_提出前確認結果.txt",
    }
    for source_name, target_name in mapping.items():
        source = docs / source_name
        if not source.is_file():
            raise RuntimeError(f"release document missing: {source}")
        shutil.copy2(source, STAGE / target_name)

    info = (
        f"Flecity Games LOOP + LINK {LINK_RELEASE_VERSION}\n"
        f"Resource version: {RESOURCE_RELEASE_VERSION}\n"
        f"Source commit: {BUILD_SOURCE_COMMIT}\n"
        "Build type: production submission candidate\n"
        "LOOP: enabled, v1.0.0 compatibility retained\n"
        "LINK: enabled, free App Store download\n"
        "LINK+: 7 days / 50,000 / WEAZEL revenue account\n"
        "Development auto-reload/tools: excluded\n"
    )
    (STAGE / "BUILD_INFO.txt").write_text(info, encoding="utf-8", newline="\n")


def validate_release() -> None:
    manifest = (STAGE / "fxmanifest.lua").read_text(encoding="utf-8")
    config = (STAGE / "config/shared.lua").read_text(encoding="utf-8")
    server_main = (STAGE / "server/main.lua").read_text(encoding="utf-8")
    framework = (STAGE / "server/bridge/framework.lua").read_text(encoding="utf-8")
    party_plus = (STAGE / "server/core/party_plus.lua").read_text(encoding="utf-8")

    required = [
        "fxmanifest.lua",
        "config/shared.lua",
        "client/main.lua",
        "server/main.lua",
        "server/bridge/framework.lua",
        "server/core/play.lua",
        "server/core/party.lua",
        "server/core/party_plus.lua",
        "server/core/party_fall.lua",
        "server/data/party_plus_prompts.lua",
        "web/play/index.html",
        "web/play/app.js",
        "web/play/icon.svg",
        "web/party/index.html",
        "web/party/app.js",
        "web/party/icon.svg",
        "sql/001_initial.sql",
        "LINK_導入方法_運営様向け.txt",
        "LINK_運営確認用メモ.txt",
        "LINK_提出前確認結果.txt",
        "BUILD_INFO.txt",
    ]
    missing = [rel for rel in required if not (STAGE / rel).is_file()]
    if missing:
        raise RuntimeError("release is missing required files: " + ", ".join(missing))

    if f"version '{RESOURCE_RELEASE_VERSION}'" not in manifest or "-test" in manifest:
        raise RuntimeError("release manifest version is not production-safe")
    if "server/core/dev_reload.lua" in manifest:
        raise RuntimeError("development reload script remains in release manifest")

    for rel in [
        "server/core/dev_reload.lua",
        "tools",
        "release_docs",
        "TESTING.md",
        "dev-build.txt",
        "runtime-active.txt",
        "dev-runtime.txt",
    ]:
        if (STAGE / rel).exists():
            raise RuntimeError(f"development-only content remains in LINK release: {rel}")

    if "dev-build.txt" in server_main or "runtime-active.txt" in server_main:
        raise RuntimeError("development build marker logic remains in release server/main.lua")

    play_pattern = (
        r"Play\s*=\s*\{.*?enabled\s*=\s*true.*?identifier\s*=\s*'flecity_play'.*?"
        r"name\s*=\s*'LOOP'.*?defaultApp\s*=\s*false.*?game\s*=\s*true.*?price\s*=\s*0"
    )
    party_pattern = (
        r"Party\s*=\s*\{.*?enabled\s*=\s*true.*?identifier\s*=\s*'flecity_party'.*?"
        r"name\s*=\s*'LINK'.*?defaultApp\s*=\s*false.*?game\s*=\s*true.*?price\s*=\s*0"
    )
    plus_pattern = (
        r"PartyPlus\s*=\s*\{.*?Enabled\s*=\s*true.*?Price\s*=\s*50000.*?"
        r"DurationSeconds\s*=\s*7\s*\*\s*24\s*\*\s*60\s*\*\s*60.*?"
        r"MoneyType\s*=\s*'bank'.*?RevenueAccount\s*=\s*'weazel'.*?"
        r"RevenueProvider\s*=\s*'auto'"
    )
    if not re.search(play_pattern, config, flags=re.S):
        raise RuntimeError("LOOP App Store configuration changed unexpectedly")
    if not re.search(party_pattern, config, flags=re.S):
        raise RuntimeError("LINK App Store configuration is not release-safe")
    if not re.search(plus_pattern, config, flags=re.S):
        raise RuntimeError("LINK+ configuration is not the approved 7-day / 50,000 / WEAZEL setup")

    for needle in [
        "exports['Renewed-Banking']:addAccountMoney",
        "exports['Renewed-Banking']:removeAccountMoney",
        "exports['qb-banking']:AddMoney",
        "exports['qb-banking']:RemoveMoney",
    ]:
        if needle not in framework:
            raise RuntimeError(f"society banking adapter missing: {needle}")

    for needle in ["depositRevenue", "REVENUE_DEPOSIT_FAILED", "reverseRevenue", "refund"]:
        if needle not in party_plus:
            raise RuntimeError(f"LINK+ revenue safety logic missing: {needle}")

    operator_text = (
        (STAGE / "LINK_導入方法_運営様向け.txt").read_text(encoding="utf-8")
        + (STAGE / "LINK_運営確認用メモ.txt").read_text(encoding="utf-8")
    )
    if "経済sink" in operator_text:
        raise RuntimeError("outdated economy-sink wording remains in operator documents")


def make_zip() -> tuple[Path, str]:
    zip_path = DIST / ZIP_NAME
    if zip_path.exists():
        raise RuntimeError(f"submission ZIP already exists; preserve it and inspect first: {zip_path}")
    checksum = DIST / f"{ZIP_NAME}.sha256"
    if checksum.exists():
        raise RuntimeError(f"submission checksum already exists; preserve it and inspect first: {checksum}")
    submission = RESOURCE / "release_docs" / "PARTY_SUBMISSION_MESSAGE_JA.txt"
    target_message = DIST / SUBMISSION_MESSAGE_NAME
    if target_message.exists():
        raise RuntimeError(f"submission message already exists; preserve it and inspect first: {target_message}")

    files = sorted(path for path in STAGE.rglob("*") if path.is_file())
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in files:
            arcname = (Path("flecity_games") / path.relative_to(STAGE)).as_posix()
            archive.write(path, arcname)

    digest = hashlib.sha256(zip_path.read_bytes()).hexdigest()
    checksum.write_text(f"{digest}  {ZIP_NAME}\n", encoding="ascii")

    if not submission.is_file():
        raise RuntimeError(f"submission message missing: {submission}")
    shutil.copy2(submission, target_message)
    return zip_path, digest


def main() -> None:
    DIST.mkdir(parents=True, exist_ok=True)
    submission_message = RESOURCE / "release_docs" / "PARTY_SUBMISSION_MESSAGE_JA.txt"
    if not submission_message.is_file():
        raise RuntimeError(f"submission message missing: {submission_message}")
    for target in (
        STAGE_ROOT,
        DIST / ZIP_NAME,
        DIST / f"{ZIP_NAME}.sha256",
        DIST / SUBMISSION_MESSAGE_NAME,
    ):
        if target.exists():
            raise RuntimeError(f"CONFLICT_STOP: preserve existing output and inspect first: {target}")
    copy_release_tree()
    patch_manifest()
    patch_server_main()
    add_release_docs()
    validate_release()
    zip_path, digest = make_zip()
    print(f"LOOP + LINK submission candidate: {zip_path}")
    print(f"SHA256: {digest}")
    print("Submission package validation: PASS")
    print("Live multiplayer QA is still required before final submission.")


if __name__ == "__main__":
    main()
