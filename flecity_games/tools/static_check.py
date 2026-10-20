#!/usr/bin/env python3
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
GAME = ROOT / "flecity_games"

errors = []

def fail(message):
    errors.append(message)

def read(path):
    return (ROOT / path).read_text(encoding="utf-8")

play_js = read("flecity_games/web/play/app.js")
party_js = read("flecity_games/web/party/app.js")
play_html = read("flecity_games/web/play/index.html")
party_html = read("flecity_games/web/party/index.html")
client = read("flecity_games/client/main.lua")
server = read("flecity_games/server/main.lua")
registry = read("flecity_games/shared/game_registry.lua")
fx = read("flecity_games/fxmanifest.lua")
bridge = read("flecity_games/web/shared/bridge.js")
errors_js = read("flecity_games/web/shared/errors.js")

def dom_ids(js):
    return set(re.findall(r"getElementById\('([^']+)'\)", js))

for name, js, html in (
    ("PLAY", play_js, play_html),
    ("PARTY", party_js, party_html),
):
    missing = sorted(i for i in dom_ids(js) if f'id="{i}"' not in html)
    if missing:
        fail(f"{name}: missing DOM ids: {', '.join(missing)}")

actions = sorted(set(re.findall(r"FlecityBridge\.call\('([^']+)'", play_js + "\n" + party_js)))
mapped = dict(re.findall(r"([A-Za-z0-9_]+)='(flecity_games:[^']+)'", client))
local_actions = {"bridgePing"}
for action in actions:
    if action not in mapped and action not in local_actions:
        fail(f"client callback map missing action: {action}")

for action, callback in mapped.items():
    if f"['{callback}']" not in server:
        fail(f"server callback missing for {action}: {callback}")

enabled = re.findall(r"id='([^']+)'[^\n]*enabled=true", registry)
disabled = re.findall(r"id='([^']+)'[^\n]*enabled=false", registry)
if len(enabled) != 15:
    fail(f"expected 15 enabled games, found {len(enabled)}: {enabled}")
if disabled:
    fail(f"initial registry still contains disabled games: {disabled}")

if "ui_page" in fx:
    fail("fxmanifest must not declare ui_page; LB Phone owns the custom app iframe")

if "globalThis.fetchNui" not in bridge:
    fail("LB Phone fetchNui bridge is missing")
if "../shared/errors.js" not in play_html or "../shared/errors.js" not in party_html:
    fail("shared error dictionary must be loaded by both apps")
if "NUI_UNAVAILABLE" not in errors_js or "NOT_IN_ROOM" not in errors_js:
    fail("shared error dictionary is incomplete")

if "'lb-phone'" not in fx or "'oxmysql'" not in fx:
    fail("fxmanifest dependencies must include lb-phone and oxmysql")
if "'server/core/text.lua'" not in fx:
    fail("UTF-8 text helper is not loaded by fxmanifest")

text_lua = read("flecity_games/server/core/text.lua")
if "utf8.len" not in text_lua or "utf8.offset" not in text_lua or "utf8Truncate" not in text_lua:
    fail("UTF-8 text helper/selftest is incomplete")

config = read("flecity_games/config/shared.lua")
identifiers = re.findall(r"identifier\s*=\s*'([^']+)'", config)
if len(identifiers) < 2 or len(set(identifiers[:2])) != 2:
    fail("PLAY and PARTY app identifiers must both exist and be unique")

sql = read("flecity_games/sql/001_initial.sql")
database_lua = read("flecity_games/server/core/database.lua")
if re.search(r"\b(DROP\s+TABLE|TRUNCATE\s+TABLE)\b", sql, re.I):
    fail("destructive DDL found in initial SQL")

required_schema_markers = (
    "flecity_game_profiles",
    "display_name VARCHAR(100)",
    "settings_json LONGTEXT",
    "flecity_game_scores",
    "session_token VARCHAR(192)",
    "uq_flecity_game_session_token",
    "flecity_game_saves",
    "game_version INT UNSIGNED",
    "flecity_game_achievements",
    "flecity_game_daily",
    "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
)
for marker in required_schema_markers:
    if marker not in sql:
        fail(f"manual SQL missing schema marker: {marker}")
    if marker not in database_lua:
        fail(f"automatic DB schema missing marker: {marker}")

lua_sources = [
    p for p in GAME.rglob("*.lua")
    if p.as_posix() != (GAME / "server/bridge/framework.lua").as_posix()
]
for source in lua_sources:
    text = source.read_text(encoding="utf-8", errors="ignore")
    if "exports.qbx_core" in text or "exports['qbx_core']" in text or 'exports["qbx_core"]' in text:
        fail(f"framework-specific qbx_core access outside adapter: {source.relative_to(ROOT)}")

if "partyUpdate" not in client or "partyDrawStroke" not in client:
    fail("PARTY direct-push client wiring is missing")
if "partyUpdate" not in party_js or "partyDrawStroke" not in party_js:
    fail("PARTY direct-push UI wiring is missing")
if "action=='bridgePing'" not in client:
    fail("local LB Phone bridgePing diagnostic is missing")
if "fixBlur=true" in client or "fixBlur=false" not in client:
    fail("LB Phone fixBlur must remain disabled while the UI uses px-based CSS")
if "globalThis.onNuiEvent" not in party_js or "registerPhonePushChannel" not in party_js:
    fail("PARTY official LB Phone push listener is missing")
if "if(!phonePushRegistered)handlePartyMessage(event.data)" not in party_js:
    fail("PARTY raw push fallback must be gated when onNuiEvent is active")
if "lastRoomRevision" not in party_js:
    fail("PARTY stale snapshot revision guard is missing")
if "saveWithRetry" not in play_js:
    fail("PLAY autosave retry helper is missing")

required_security_markers = (
    "INVALID_BLOCK_REPLAY",
    "INVALID_MERGE_REPLAY",
    "INVALID_STACK_REPLAY",
    "INVALID_SESSION_SEED",
)
play_lua = read("flecity_games/server/core/play.lua")
if "SELECT s.player_identifier" in play_lua:
    fail("ranking payload must not select internal player_identifier")
if "dailyNumber(date)" not in play_lua or "dailyDateParsing" not in play_lua:
    fail("Daily date parsing regression guard is missing")
if "metadata_json NOT LIKE '%%\"dailyDate\":%%'" not in play_lua:
    fail("normal leaderboard must exclude Daily runs")
for marker in required_security_markers:
    if marker not in play_lua:
        fail(f"PLAY security marker missing: {marker}")
if "clearForeignSourceSessions" not in play_lua:
    fail("PLAY character-switch session cleanup is missing")

party_lua = read("flecity_games/server/core/party.lua")
framework_lua = read("flecity_games/server/bridge/framework.lua")
if "FlecityGamesText.Length(guess)" not in party_lua or "FlecityGamesText.Length(value)" not in party_lua:
    fail("PARTY user text limits must use UTF-8 character length")
if "local function roomForPlayer(source,id)" not in party_lua:
    fail("PARTY character-switch room guard is missing")
if "QBCore:Server:OnPlayerUnload" not in framework_lua or "flecity_games:framework:playerUnloaded" not in framework_lua:
    fail("framework character-unload bridge is missing")
if "flecity_games:framework:playerUnloaded" not in server:
    fail("server character-unload cleanup handler is missing")
for marker in (
    "wordWolfPrivacy",
    "liarPrivacy",
    "drawPrivacy",
    "telephonePrivacy",
    "roomRevision",
    "disconnectedVoteIgnored",
    "roundAbortLowPlayers",
    "secretRoleDisconnectAbort",
):
    if marker not in party_lua:
        fail(f"PARTY selftest missing: {marker}")

expected_play_order = ["quick_tap", "stop", "stack", "block", "merge", "mines", "nonogram"]
expected_party_order = ["reaction", "stop_battle", "vote", "majority", "word_wolf", "liar", "draw", "telephone"]
ordered_defs = re.findall(r"order=(\d+),id='([^']+)'[^\n]*app='(play|party)'", registry)
normalized_defs = sorted((int(order), game_id, app) for order, game_id, app in ordered_defs)
play_order = [game_id for _, game_id, app in normalized_defs if app == "play"]
party_order = [game_id for _, game_id, app in normalized_defs if app == "party"]
if play_order != expected_play_order:
    fail(f"PLAY registry order mismatch: {play_order}")
if party_order != expected_party_order:
    fail(f"PARTY registry order mismatch: {party_order}")

server_error_codes = set(re.findall(r"error='([A-Z0-9_]+)'", server + "\n" + play_lua + "\n" + party_lua))
missing_error_messages = sorted(code for code in server_error_codes if code not in errors_js)
if missing_error_messages:
    fail(f"shared error dictionary missing codes: {', '.join(missing_error_messages)}")

scan_files = [
    p for p in GAME.rglob("*")
    if p.is_file()
    and p.name != "static_check.py"
    and p.suffix.lower() in {".lua", ".js", ".html", ".css", ".sql", ".md"}
]
all_text = "\n".join(
    p.read_text(encoding="utf-8", errors="ignore")
    for p in scan_files
)
if "<<<<<<<" in all_text or ">>>>>>>" in all_text:
    fail("merge conflict markers found")
if re.search(r"\bTODO\b|\bFIXME\b", all_text):
    fail("TODO/FIXME marker found in flecity_games source/docs")

if errors:
    print("Flecity Games static check FAILED")
    for error in errors:
        print(" -", error)
    sys.exit(1)

print("Flecity Games static check PASS")
print(f" - enabled games: {len(enabled)}")
print(f" - UI actions mapped: {len(actions)}")
print(" - DOM references: PASS")
print(" - LB Phone bridge: PASS")
print(" - replay/privacy markers: PASS")
