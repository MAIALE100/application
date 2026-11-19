#!/usr/bin/env python3
"""Build a reversible LINK UI delta and inspect targets; never deploy or restart."""

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import shutil
import sys
import tempfile
import zipfile

PATCH = (
    "web/party/index.html", "web/party/app.js",
    "web/party/redesign.css", "web/party/redesign.js",
)
NEW = set(PATCH[2:])
TOOL = "tools/link_ui_v2_package.py"
REVIEW_ONLY = {
    TOOL, "tests/link-ui-v2.browser.mjs", "tests/link-ui-v2.fixture.mjs",
    "docs/LINK_UI_V2_VALIDATION_JA.md",
}
RUNTIME_MARKERS = {
    "dev-auto-reload.enabled", "dev-build.txt", "dev-reload-v2.active",
    "dev-reload.token", "dev-runtime.txt", "runtime-active.txt",
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def relative_file(name):
    path = PurePosixPath(name)
    require(bool(name) and "\\" not in name and ":" not in name
            and not path.is_absolute() and ".." not in path.parts
            and str(path) == name, "Unsafe manifest path")
    return path


def files(root):
    require(root.is_dir() and not root.is_symlink(), "Expected a regular directory")
    result = {}
    for path in sorted(root.rglob("*")):
        require(not path.is_symlink(), "Symlinks are not allowed")
        if path.is_file():
            result[path.relative_to(root).as_posix()] = path
    return result


def manifest(contents):
    return {name: {"sha256": digest(data), "bytes": len(data)}
            for name, data in sorted(contents.items())}


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def read_manifest(path):
    value = json.loads(path.read_text(encoding="utf-8-sig"))
    require(isinstance(value, dict) and value, "Empty or invalid manifest")
    for name, item in value.items():
        relative_file(name)
        require(isinstance(item, dict) and isinstance(item.get("bytes"), int)
                and item["bytes"] >= 0 and isinstance(item.get("sha256"), str)
                and len(item["sha256"]) == 64
                and all(char in "0123456789abcdef" for char in item["sha256"]),
                "Invalid manifest entry")
    return value


def verify_package(package):
    expected = read_manifest(package / "package-sha256.json")
    actual = files(package)
    require(set(actual) == set(expected) | {"package-sha256.json"},
            "Package file inventory changed")
    for name, item in expected.items():
        data = actual[name].read_bytes()
        require(manifest({name: data})[name] == item, "Package hash mismatch: " + name)
    before = read_manifest(package / "baseline-sha256.json")
    after = read_manifest(package / "candidate-sha256.json")
    require(set(after) == set(before) | NEW and not (set(before) & NEW),
            "Unexpected candidate inventory")
    changed = {name for name in after if before.get(name) != after[name]}
    require(changed == set(PATCH), "Package must change exactly the four LINK UI files")
    for name in PATCH:
        require(manifest({name: (package / "after" / name).read_bytes()})[name] == after[name],
                "Candidate payload mismatch: " + name)
        if name in before:
            require(manifest({name: (package / "before" / name).read_bytes()})[name] == before[name],
                    "Rollback payload mismatch: " + name)
    return before, after


def target_plan(package, target, state="baseline"):
    """Read only: verify the full resource and return a forward/rollback plan."""
    require(target.name.lower() == "flecity_games", "Target resource must be named flecity_games")
    before, after = verify_package(package)
    expected = before if state == "baseline" else after
    actual = files(target)
    errors = []
    for name, item in expected.items():
        path = actual.get(name)
        if path is None or manifest({name: path.read_bytes()})[name] != item:
            errors.append(name)
    errors.extend(sorted(set(actual) - set(expected) - RUNTIME_MARKERS))
    require(not errors, "Target drift or unexpected files: " + ", ".join(sorted(set(errors))))
    return {
        "status": "PASS", "mode": "READ_ONLY_PLAN", "targetState": state,
        "verifiedFiles": len(expected), "resource": "flecity_games",
        "replace": list(PATCH if state == "baseline" else PATCH[:2]),
        "removeOnRollback": sorted(NEW) if state == "candidate" else [],
        "serverChanged": False, "restartPerformed": False,
        "deploymentApprovalRequired": True,
    }


README = """# LINK UI v2 テスト用差分パッケージ

このパッケージは提出版ではありません。実FiveM、LB Phone、複数人同期、DB、課金の確認済みを意味しません。
配備処理・サーバー再起動処理は含みません。稼働中の flecity_games は LOOP と LINK の共有リソースです。

after/ は LINK の画面4ファイルだけです。before/ は既存2ファイルの完全な元バイト列です。
新規 redesign.css と redesign.js は復元時に削除します。エンジン、共有画面、LOOP、設定、DBは変更しません。
baseline-sha256.json と candidate-sha256.json はリソース全体の基準ハッシュです。
package-sha256.json はパッケージ内容の検査用です。開発用トークンや実行マーカーは収録していません。

## Codexが実施する読み取り確認

python link_ui_v2_package.py preflight --package <展開したパッケージ> --target <対象のflecity_games>

復元前は同じコマンドへ --state candidate を付けます。どちらも読み取り専用で、ファイルを置換しません。
検査は全基準ファイルと対象名を確認し、追加ファイルや途中変更を検出したら停止します。
既存の開発用実行マーカーは検査から除外し、内容を読み取り・出力しません。

## 承認後の反映と復元

対象・影響・復旧手順を示した明示承認後、Codexが最新の無人確認と必要条件を再確認します。
対象4ファイルと全体基準の一致を確認し、対象自身のバックアップを別途作成・照合してから4ファイルだけ反映します。
反映後は candidate の読み取り検査を行います。必要時の再起動は共有resource単位で判断します。
復元は candidate 一致確認後、before/ の2ファイルを戻し、新規2ファイルだけを削除し、baseline一致を再確認します。
途中で変更を検出した場合は自動上書き・削除せず、両方を保全して原因を確認します。
ユーザーに手作業でのコピーやコマンド実行を依頼するための資料ではありません。
"""


def build(baseline, source, output, inventory):
    require(not output.exists() and not output.with_suffix(".zip").exists(),
            "Output already exists; choose a fresh output directory")
    require(not any(output == root or output.is_relative_to(root) or root.is_relative_to(output)
                    for root in (baseline, source)), "Output must be separate from source and baseline")
    base_files, source_files = files(baseline), files(source)
    require(not (set(base_files) & (NEW | RUNTIME_MARKERS)), "Baseline contains new UI or runtime marker files")
    require(set(source_files) - REVIEW_ONLY == set(base_files) | NEW,
            "Source contains unexpected additions or omissions")
    before_data = {name: path.read_bytes() for name, path in base_files.items()}
    after_data = {name: source_files[name].read_bytes() for name in set(base_files) | NEW}
    before, after = manifest(before_data), manifest(after_data)
    recorded = json.loads(inventory.read_text(encoding="utf-8-sig"))
    require(isinstance(recorded, list), "Invalid baseline inventory")
    recorded = {entry["path"]: {"sha256": entry["sha256"].lower(), "bytes": entry["bytes"]}
                for entry in recorded}
    require(before == recorded, "Baseline differs from independently captured inventory")
    require({name for name in after if before.get(name) != after[name]} == set(PATCH),
            "Only the four declared LINK UI files may change; all four must be present and changed")
    output.mkdir(parents=True)
    for directory, contents in (("before", before_data), ("after", after_data)):
        for name in PATCH:
            if name in contents:
                destination = output / directory / name
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(contents[name])
    write_json(output / "baseline-sha256.json", before)
    write_json(output / "candidate-sha256.json", after)
    write_json(output / "change-plan.json", {
        "resource": "flecity_games", "packageType": "TEST_ONLY_UI_DELTA",
        "baselineFiles": len(before), "candidateFiles": len(after),
        "changedFiles": list(PATCH), "newFiles": sorted(NEW),
        "runtimeMarkersExcluded": sorted(RUNTIME_MARKERS),
        "deploymentPerformed": False, "requiresExplicitDeploymentApproval": True,
    })
    (output / "README_JA.md").write_text(README, encoding="utf-8")
    shutil.copyfile(__file__, output / "link_ui_v2_package.py")
    write_json(output / "package-sha256.json",
               manifest({name: path.read_bytes() for name, path in files(output).items()}))
    verify_package(output)
    archive = output.with_suffix(".zip")
    with zipfile.ZipFile(archive, "x", compression=zipfile.ZIP_DEFLATED) as handle:
        for name, path in files(output).items():
            handle.write(path, name)
    with zipfile.ZipFile(archive) as handle:
        require(handle.testzip() is None, "ZIP integrity failure")
        require(set(handle.namelist()) == set(files(output)), "ZIP inventory mismatch")
        for name, path in files(output).items():
            require(handle.read(name) == path.read_bytes(), "ZIP content mismatch: " + name)
    return {"status": "PASS", "package": str(output), "zip": str(archive),
            "zipSha256": digest(archive.read_bytes()), "baselineFiles": len(before),
            "candidateFiles": len(after), "changedFiles": list(PATCH), "serverChanged": False}


def self_test():
    """Exercise forward/rollback on a disposable copy, never on a supplied target."""
    with tempfile.TemporaryDirectory(prefix="link-ui-package-") as folder:
        root = Path(folder)
        baseline, source, target = (root / name / "flecity_games" for name in ("base", "source", "target"))
        sample = {PATCH[0]: b"original html\r\n", PATCH[1]: b"original js\n",
                  "server/core/party.lua": b"unchanged engine\n", "web/play/app.js": b"unchanged LOOP\n"}
        for name, data in sample.items():
            path = baseline / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        shutil.copytree(baseline, source)
        shutil.copytree(baseline, target)
        for name in PATCH:
            (source / name).write_bytes(("candidate " + name).encode())
        inventory = root / "inventory.json"
        write_json(inventory, [{"path": name, **item} for name, item in manifest(sample).items()])
        package = root / "package"
        build(baseline, source, package, inventory)
        require(target_plan(package, target)["verifiedFiles"] == 4, "Baseline preflight failed")
        for name in PATCH:
            shutil.copyfile(package / "after" / name, target / name)
        require(target_plan(package, target, "candidate")["verifiedFiles"] == 6, "Candidate preflight failed")
        for name in PATCH[:2]:
            shutil.copyfile(package / "before" / name, target / name)
        for name in NEW:
            (target / name).unlink()
        require(target_plan(package, target)["status"] == "PASS", "Rollback failed")
        require({name: path.read_bytes() for name, path in files(target).items()} == sample,
                "Rollback did not restore exact bytes")
        for path in (target / "server/core/party.lua", package / "after" / PATCH[0]):
            original = path.read_bytes()
            path.write_bytes(b"tampered")
            rejected = False
            try:
                target_plan(package, target)
            except ValueError:
                rejected = True
            path.write_bytes(original)
            require(rejected, "Drift or payload tampering was not rejected")
    return {"status": "PASS", "checks": ["ZIP integrity", "full baseline preflight",
            "full candidate preflight", "byte-exact rollback", "engine drift rejection", "payload tamper rejection"],
            "serverChanged": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", nargs="?", choices=("preflight", "build", "self-test"), default="preflight")
    for name in ("baseline", "source", "output", "inventory", "package", "target"):
        parser.add_argument("--" + name, type=lambda value: Path(value).resolve())
    parser.add_argument("--state", choices=("baseline", "candidate"), default="baseline")
    args = parser.parse_args()
    needed = {"build": ("baseline", "source", "output", "inventory"),
              "preflight": ("package", "target"), "self-test": ()}[args.command]
    for name in needed:
        if getattr(args, name) is None:
            parser.error("--" + name + " is required for " + args.command)
    if args.command == "build":
        return build(args.baseline, args.source, args.output, args.inventory)
    if args.command == "self-test":
        return self_test()
    return target_plan(args.package, args.target, args.state)


if __name__ == "__main__":
    try:
        print(json.dumps(main(), ensure_ascii=False, indent=2))
    except (OSError, ValueError, KeyError, zipfile.BadZipFile) as error:
        print(json.dumps({"status": "FAIL", "error": str(error), "serverChanged": False},
                         ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
