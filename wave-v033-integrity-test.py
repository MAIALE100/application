#!/usr/bin/env python3
"""Regression: WAVE studio extras must match both deployment and CI SHA256 pins."""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
asset = ROOT / "wave-v033-studio-extras.js"
updater = (ROOT / "wave-update.ps1").read_text(encoding="utf-8")
workflow = (ROOT / ".github/workflows/wave-check.yml").read_text(encoding="utf-8")
actual = hashlib.sha256(asset.read_bytes()).hexdigest()

updater_match = re.search(r"if \(\$extrasHash -ne '([0-9A-Fa-f]{64})'\)", updater)
workflow_match = re.search(
    r'echo "([0-9a-fA-F]{64})  wave-v033-studio-extras\.js" \| sha256sum -c -',
    workflow,
)
if not updater_match or not workflow_match:
    raise SystemExit("FAIL: WAVE studio SHA256 pin missing in updater or CI")
if updater_match.group(1).lower() != actual:
    raise SystemExit("FAIL: updater WAVE studio SHA256 differs from source")
if workflow_match.group(1).lower() != actual:
    raise SystemExit("FAIL: CI WAVE studio SHA256 differs from source")
if "WAVE_BAR_NAVIGATOR_V034" not in asset.read_text(encoding="utf-8"):
    raise SystemExit("FAIL: WAVE bar navigator missing from studio asset")
if "python3 wave-v033-integrity-test.py" not in workflow:
    raise SystemExit("FAIL: studio integrity regression not wired into CI")

# Verify that the Windows deployment and CI build add the same CSS rules.
# Ignore comments and indentation, but reject missing, extra or reordered rules.
updater_css = re.search(r"\$extraCss=@'\r?\n(.*?)\r?\n'@", updater, re.S)
ci_css = re.search(r'(?ms)^\s*extra = """\r?\n(.*?)^\s*"""', workflow)
if not updater_css or not ci_css:
    raise SystemExit("FAIL: studio CSS block missing in updater or CI")

def declarations(block: str) -> list[str]:
    without_comments = re.sub(r"/\*.*?\*/", "", block, flags=re.S)
    return [re.sub(r"\s+", "", line) for line in without_comments.splitlines() if line.strip()]

if declarations(updater_css.group(1)) != declarations(ci_css.group(1)):
    raise SystemExit("FAIL: WAVE studio CSS differs between Windows updater and CI")

print("WAVE studio integrity pins and deployment CSS parity: PASS (" + actual + ")")
