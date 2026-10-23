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
dev_reload = read("flecity_games/server/core/dev_reload.lua")
server = read("flecity_games/server/main.lua")
play_lua = read("flecity_games/server/core/play.lua")
registry = read("flecity_games/shared/game_registry.lua")
fx = read("flecity_games/fxmanifest.lua")
config = read("flecity_games/config/shared.lua")
database_lua = read("flecity_games/server/core/database.lua")
party_fall_lua = read("flecity_games/server/core/party_fall.lua")
party_fall_js = read("flecity_games/web/party/fall_battle.js")
bridge = read("flecity_games/web/shared/bridge.js")
errors_js = read("flecity_games/web/shared/errors.js")
safety_server = read("flecity_dev_safety/server.lua")
safety_fx = read("flecity_dev_safety/fxmanifest.lua")

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
if len(enabled) != 30:
    fail(f"expected 30 enabled games, found {len(enabled)}: {enabled}")
play_enabled = re.findall(r"id='([^']+)'[^\n]*app='play'[^\n]*enabled=true", registry)
party_enabled = re.findall(r"id='([^']+)'[^\n]*app='party'[^\n]*enabled=true", registry)
if len(play_enabled) != 15:
    fail(f"PLAY game count is frozen at 15; found {len(play_enabled)}: {play_enabled}")
if len(party_enabled) != 15:
    fail(f"PARTY game count must be 15; found {len(party_enabled)}: {party_enabled}")
if disabled:
    fail(f"initial registry still contains disabled games: {disabled}")

if "ui_page" in fx:
    fail("fxmanifest must not declare ui_page; LB Phone owns the custom app iframe")

if "globalThis.fetchNui" not in bridge or "typeof fetchNui === 'function'" not in bridge:
    fail("LB Phone fetchNui bridge must support both property and direct-global bindings")
if "../shared/errors.js" not in play_html or "../shared/errors.js" not in party_html:
    fail("shared error dictionary must be loaded by both apps")
if "NUI_UNAVAILABLE" not in errors_js or "NOT_IN_ROOM" not in errors_js:
    fail("shared error dictionary is incomplete")

if "'lb-phone'" not in fx or "'oxmysql'" not in fx:
    fail("fxmanifest dependencies must include lb-phone and oxmysql")
if "games-reload.request" not in safety_server or "ExecuteCommand('refresh')" not in safety_server or "restart flecity_games" not in safety_server or "SaveResourceFile" not in safety_server or "version=2" not in safety_server:
    fail("external PLAY reload helper is missing")
if "version '1.1.0-dev'" not in safety_fx:
    fail("DEV Safety external reload helper version is stale")
if "'server/core/text.lua'" not in fx:
    fail("UTF-8 text helper is not loaded by fxmanifest")
if "'server/core/party_plus.lua'" not in fx:
    fail("PARTY+ entitlement layer is not loaded by fxmanifest")
if "Price = 50000" not in config or "DurationSeconds = 7 * 24 * 60 * 60" not in config:
    fail("PARTY+ 7-day / 50000 plan config is missing")
if "RemoveMoney" not in read("flecity_games/server/bridge/framework.lua") or "flecity_game_subscriptions" not in database_lua:
    fail("PARTY+ payment/persistence wiring is incomplete")

text_lua = read("flecity_games/server/core/text.lua")
if "utf8.len" not in text_lua or "utf8.offset" not in text_lua or "utf8Truncate" not in text_lua:
    fail("UTF-8 text helper/selftest is incomplete")

profile_lua = read("flecity_games/server/core/profile.lua")
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
    "flecity_game_subscriptions",
    "active_until DATETIME NOT NULL",
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
if "partySubscribePlus" not in party_js or "partyCancelPlus" not in party_js or 'id="partyPlusCard"' not in party_html:
    fail("PARTY+ subscription UI is missing")
if "partySubmitNgWordClue" not in party_js or "partySubmitNgWordGuess" not in party_js or 'id="ngWordPanel"' not in party_html:
    fail("PARTY+ NG WORD client flow is missing")
if not re.search(r"id='ng_word'[^\n]*premium=true", registry):
    fail("PARTY+ NG WORD registry metadata is missing")
if "partySubmitFakeAnswer" not in party_js or "partySubmitFakeVote" not in party_js or 'id="fakeAnswerPanel"' not in party_html:
    fail("PARTY+ FAKE ANSWER client flow is missing")
if not re.search(r"id='fake_answer'[^\n]*premium=true", registry):
    fail("PARTY+ FAKE ANSWER registry metadata is missing")
if "partySubmitBombPass" not in party_js or 'id="bombPanel"' not in party_html:
    fail("PARTY+ BOMB client flow is missing")
if not re.search(r"id='bomb'[^\n]*premium=true", registry):
    fail("PARTY+ BOMB registry metadata is missing")
if "partySubmitMemoryChain" not in party_js or 'id="memoryChainPanel"' not in party_html:
    fail("PARTY+ MEMORY CHAIN client flow is missing")
if not re.search(r"id='memory_chain'[^\n]*premium=true", registry):
    fail("PARTY+ MEMORY CHAIN registry metadata is missing")
if "partySubmitFallBattle" not in party_fall_js or 'id="fallBattlePanel"' not in party_html:
    fail("PARTY+ FALL BATTLE client flow is missing")
if not re.search(r"id='fall_battle'[^\n]*premium=true", registry):
    fail("PARTY+ FALL BATTLE registry metadata is missing")
if "'server/core/party_fall.lua'" not in fx or "FlecityGamesPartyFall.Validate" not in party_fall_lua:
    fail("PARTY+ FALL BATTLE server verifier is missing")
if "FlecityGamesPartyFall.DebugSelftest" not in party_fall_lua:
    fail("PARTY+ FALL BATTLE verifier selftest is missing")
if "forfeited=true" not in party_lua or "fallBattleDisconnectForfeit" not in party_lua:
    fail("PARTY+ FALL BATTLE disconnect/reconnect reset guard is missing")
if "FALL_BASE_SHAPES" in party_fall_js:
    fail("PARTY FALL BATTLE client should keep its implementation isolated from PLAY source markers")
if "PARTY_PLUS_REQUIRED" not in errors_js:
    fail("PARTY+ error mapping is missing")

party_plus_prompts = read("flecity_games/server/data/party_plus_prompts.lua")
taboo_count = len(re.findall(r"\{word='", party_plus_prompts))
fake_answer_count = len(re.findall(r"\{question='", party_plus_prompts))
bomb_match = re.search(r"FlecityGamesPartyPlusPrompts\.Bomb\s*=\s*\{(.*?)\n\}", party_plus_prompts, re.S)
bomb_count = len(re.findall(r"^\s*'[^']+',?\s*$", bomb_match.group(1), re.M)) if bomb_match else 0
if taboo_count < 120 or fake_answer_count < 124 or bomb_count < 180:
    fail(f"PARTY+ prompt banks too small: taboo={taboo_count}, fake={fake_answer_count}, bomb={bomb_count}")
if "action=='bridgePing'" not in client:
    fail("local LB Phone bridgePing diagnostic is missing")
if "fixBlur=true" not in client or "fixBlur=false" in client:
    fail("LB Phone fixBlur must be enabled for rem-based custom app rendering")
if "local function appEnabled(app)" not in client or "app.enabled~=false" not in client:
    fail("LB Phone app visibility flag support is missing")
if "local partyAppEnabled=not" not in server or "name:find('flecity_games:party:',1,true)==1" not in server:
    fail("server PARTY callback visibility guard is missing")
if config.count("enabled = true") < 2:
    fail("PLAY/PARTY app visibility flags are missing from config")
if "name = 'LOOP'" not in config or "icon = 'web/play/icon.svg'" not in config:
    fail("LOOP app branding/icon config is missing")
if not re.search(r"Play\s*=\s*\{.*?defaultApp\s*=\s*false.*?game\s*=\s*true.*?size\s*=\s*1800.*?price\s*=\s*0", config, re.S):
    fail("LOOP must be a free LB Phone App Store download")
if "defaultApp=app.defaultApp,game=app.game,size=app.size,price=app.price" not in client:
    fail("LOOP App Store metadata is not forwarded to AddCustomApp")
if "ExecuteCommand('refresh')" not in dev_reload or "restart %s" not in dev_reload:
    fail("auto-reload must refresh FiveM metadata before restarting flecity_games")
if "reload_v2=1" not in dev_reload:
    fail("auto-reload runtime capability stamp is missing")
if "APP_ALREADY_EXISTS" not in client or "RemoveCustomApp(app.identifier)" not in client or "refreshed custom app registration" not in client:
    fail("LB Phone custom app registration refresh path is missing")
if "uiCacheBust" not in client or "?cb=" not in client:
    fail("LB Phone custom app UI cache-busting is missing")
if 'http-equiv="Cache-Control"' not in play_html or 'http-equiv="Cache-Control"' not in party_html:
    fail("PLAY/PARTY no-cache document guards are missing")
if "globalThis.onNuiEvent" not in party_js or "registerPhonePushChannel" not in party_js:
    fail("PARTY official LB Phone push listener is missing")
if "if(!phonePushRegistered)handlePartyMessage(event.data)" not in party_js:
    fail("PARTY raw push fallback must be gated when onNuiEvent is active")
if "lastRoomRevision" not in party_js:
    fail("PARTY stale snapshot revision guard is missing")
if "saveWithRetry" not in play_js:
    fail("PLAY autosave retry helper is missing")
if "startSessionWithRetry" not in play_js:
    fail("PLAY session-start retry helper is missing")
if play_js.count("startSessionWithRetry(") != 16:
    fail("all 15 PLAY games must start through the shared retry/lifecycle wrapper")
if play_js.count("FlecityBridge.call('playStartSession'") != 1:
    fail("PLAY games must not bypass the shared session-start wrapper")
if "submitScoreWithRetry" not in play_js:
    fail("PLAY score submission retry helper is missing")
if "suspendActivePlay" not in play_js or "visibilitychange" not in play_js:
    fail("PLAY phone-hide lifecycle protection is missing")
if "onClose=playOnClose" not in client or "lb-phone:phoneToggled" not in client:
    fail("PLAY must bind cleanup to official LB Phone close lifecycle")
if "playSuspend" not in client or "playSuspend" not in play_js or "registerPlayPhoneLifecycle" not in play_js:
    fail("PLAY explicit phone-close suspend push wiring is missing")
if "flecity_games:server:playClosed" not in client or "flecity_games:server:playClosed" not in server:
    fail("PLAY delayed server fallback cleanup is missing")
if play_js.count("FlecityBridge.call('playCancelSession'") != 1 or "async function cancelPlaySession" not in play_js:
    fail("PLAY session cancellation must go through the shared retry helper")
if "appEpoch" not in play_js or "APP_SUSPENDED" not in play_js or "APP_SUSPENDED" not in errors_js:
    fail("PLAY stale session-start cancellation guard is missing")
if play_js.count("rankingGame.onchange=") != 1 or play_js.count("rankingPeriod.onchange=") != 1:
    fail("PLAY ranking change handlers must each be assigned exactly once")
if "finalizing" not in play_js or "記録を保存中です" not in play_js:
    fail("PLAY score-finalization interaction guards are missing")
if "competitionRank" not in play_js or "selfRank" not in play_js:
    fail("PLAY leaderboard self-rank/tie handling is missing")
if "playActivateSession" not in play_js or "activateMinesTiming" not in play_js or "activateNonogramTiming" not in play_js:
    fail("MINES/NONOGRAM first-action timer flow is missing")
if "confirmAction" not in play_js or 'id="confirmOverlay"' not in play_html:
    fail("PLAY destructive reset confirmation is missing")
for best_id in ("tapBest","stopBest","stackBest","blockBest","mergeBest","fallBest","minesBest","nonogramBest","memoryBest","sortBest","slideBest","colorMatchBest","numberRushBest","highLowBest","simonBest"):
    if f'id="{best_id}"' not in play_html:
        fail(f"PLAY game-screen BEST label missing: {best_id}")
for name, html in (("PLAY", play_html), ("PARTY", party_html)):
    if "componentsLoaded" not in html or "devMode=!window.invokeNative" not in html:
        fail(f"{name} must wait for LB Phone componentsLoaded before bootstrapping")
    if "setTimeout(loadApp" in html:
        fail(f"{name} contains an unsafe timed bootstrap before LB Phone injects fetchNui")
if "setGameIcon" not in play_js or "icons/quick-tap.svg" not in play_js or "icons/simon.svg" not in play_js:
    fail("PLAY dedicated SVG icon wiring is missing")
if 'id="dailyIcon"' not in play_html:
    fail("PLAY Daily icon slot is missing")
if "quickTapGrade" not in play_js or "stopRushGrade" not in play_js or "colorMatchChoiceOrder" not in play_js:
    fail("PLAY skill-feedback gameplay pass is missing")
if "playQuickRound" not in play_js or "QUICK TAP FOCUS" not in play_html or "tapRunMeta" not in play_js:
    fail("QUICK TAP FOCUS client run flow is missing")
if "FlecityGamesPlay.QuickRound" not in play_lua or "newQuickState" not in play_lua or "applyQuickTap" not in play_lua:
    fail("QUICK TAP FOCUS server-authoritative round flow is missing")
if "playQuickRound='flecity_games:play:quickRound'" not in client:
    fail("QUICK TAP FOCUS bridge callback is missing")
if not re.search(r"id='quick_tap'[^\n]*version=2", registry):
    fail("QUICK TAP FOCUS registry version must be 2")
if "playStopRound" not in play_js or "STOP! RUSH" not in play_html:
    fail("STOP RUSH client flow is missing")
if "FlecityGamesPlay.StopRound" not in play_lua or "newStopState" not in play_lua or "applyStopRound" not in play_lua:
    fail("STOP RUSH server-authoritative round flow is missing")
if "playStopRound='flecity_games:play:stopRound'" not in client:
    fail("STOP RUSH client bridge callback is missing")
if "MAX FLOW" not in play_js or "PAIR STREAK" not in play_js:
    fail("PLAY flow/streak feedback is missing")
if "memoryDeckFromSeed" not in play_js or "finishMemory" not in play_js:
    fail("MEMORY client implementation is missing")
if "colorMatchRounds" not in play_js or "openColorMatch" not in play_js:
    fail("COLOR MATCH client implementation is missing")
if "lives:Number(session.challenge&&session.challenge.lives)||3" not in play_js or "COLOR MATCH RUSH" not in play_html:
    fail("COLOR MATCH RUSH three-life client flow is missing")
if "challenge.rounds=20 challenge.lives=3 challenge.missPenaltyMs=1500" not in play_lua:
    fail("COLOR MATCH RUSH server challenge is missing")
if not re.search(r"id='color_match'[^\n]*version=2", registry):
    fail("COLOR MATCH RUSH registry version must be 2")
if "ColorMatchFocusMs = 14000" not in config:
    fail("COLOR MATCH RUSH achievement threshold is missing")
if "numberRushBoardFromSeed" not in play_js or "finishNumberRush" not in play_js:
    fail("NUMBER RUSH client implementation is missing")
if "reshuffleNumberRushRemaining" not in play_js or "rush-shift" not in play_js:
    fail("NUMBER RUSH SHIFT client flow is missing")
if "reshuffleNumberRushRemaining" not in play_lua or "perfectNumberRushHistory" not in play_lua:
    fail("NUMBER RUSH SHIFT deterministic server flow is missing")
if not re.search(r"id='number_rush'[^\n]*version=2", registry):
    fail("NUMBER RUSH SHIFT registry version must be 2")
if "NumberRushAceMs = 16000" not in config:
    fail("NUMBER RUSH SHIFT achievement threshold is missing")
if "playHighLowGuess" not in play_js or "finishHighLow" not in play_js:
    fail("HIGH & LOW server-authoritative client flow is missing")
if "playSubmitSimonRound" not in play_js or "finishSimon" not in play_js:
    fail("SIMON server-validated client flow is missing")
if "simonDaily" not in play_js or "openSimon(true)" not in play_js or "daily:simonDaily===true" not in play_js:
    fail("SIMON Daily client flow is missing")
if not re.search(r"id='simon'[^\n]*supportsDaily=true", registry):
    fail("SIMON registry Daily marker is missing")
if not re.search(r"DailyCandidates\s*=\s*\{[^\n]*'simon'[^\n]*\}", config):
    fail("SIMON must be included in the Daily candidate rotation")

required_security_markers = (
    "INVALID_BLOCK_REPLAY",
    "INVALID_MERGE_REPLAY",
    "INVALID_STACK_REPLAY",
    "INVALID_MEMORY_REPLAY",
    "INVALID_COLOR_MATCH_REPLAY",
    "INVALID_NUMBER_RUSH_REPLAY",
    "INVALID_HIGH_LOW_REPLAY",
    "INVALID_SIMON_REPLAY",
    "INVALID_SLIDE_REPLAY",
    "INVALID_FALL_REPLAY",
    "INVALID_SESSION_SEED",
)
if "startRequestId" not in play_js or "startRequestId" not in play_lua or "startRequests" not in play_lua or "START_PENDING" not in play_js:
    fail("PLAY session-start retries must be idempotent")
if "SELECT s.player_identifier" in play_lua:
    fail("ranking payload must not select internal player_identifier")
if "dailyNumber(date)" not in play_lua or "dailyDateParsing" not in play_lua:
    fail("Daily date parsing regression guard is missing")
if "currentDatabaseDate" not in play_lua or "DAILY_EXPIRED" not in play_lua or "DAILY_EXPIRED" not in errors_js:
    fail("Daily database-date rollover guard is missing")
if "metadata_json NOT LIKE '%%\"dailyDate\":%%'" not in play_lua:
    fail("normal leaderboard must exclude Daily runs")
for marker in required_security_markers:
    if marker not in play_lua:
        fail(f"PLAY security marker missing: {marker}")
if "clearForeignSourceSessions" not in play_lua:
    fail("PLAY character-switch session cleanup is missing")
if play_lua.count("sessions[token]=nil") != 1 or "local function removeSession" not in play_lua:
    fail("PLAY session teardown must go through removeSession")
if play_lua.find("local function clearForeignSourceSessions") > play_lua.find("function FlecityGamesPlay.Bootstrap"):
    fail("PLAY session helper must be defined before Bootstrap")
if play_lua.count("clearPlayerSessions(id)") < 2:
    fail("PLAY must clear orphan sessions on Bootstrap and before a new run")
if "existingScoreResponse" not in play_lua or "duplicate=true" not in play_lua:
    fail("PLAY idempotent score retry handling is missing")
if "unlockedAchievements" not in play_lua:
    fail("PLAY score retry must preserve achievement feedback")
if "ActivateSession" not in play_lua or "timingDeferred" not in play_lua or "TIMER_NOT_STARTED" not in play_lua:
    fail("PLAY deferred timer activation is missing")
for marker in ("bullseye","merge_master","mines_sprinter","nonogram_solver","color_focus","simon_master","slide_master","fall_master"):
    if marker not in play_lua or marker not in play_js:
        fail(f"PLAY achievement missing: {marker}")
if "MySQL.update.await([[INSERT IGNORE INTO flecity_game_achievements" not in play_lua:
    fail("PLAY achievement unlock must use affected-row semantics")
if "saveEpochs" not in play_lua or "SAVE_RESET" not in play_lua:
    fail("PLAY stale autosave reset protection is missing")
if "saveStateHasProgress" not in play_lua or "progressed!==true" not in play_js:
    fail("PLAY must not persist untouched resumable runs")
if "TODAY BEST" not in play_js or "displayElapsedMs" not in play_js:
    fail("PLAY Daily/result display polish is missing")
if "gameVisuals" not in play_js or "setQuickVisual" not in play_js or "setStopVisual" not in play_js:
    fail("PLAY game identity / live-state visual feedback is missing")
if "renderRecent" not in play_js or "filteredLibraryGames" not in play_js or "randomPlay.onclick" not in play_js:
    fail("PLAY recent/filter/random library navigation is missing")
if "toggleFavorite" not in play_js or "favorite-toggle" not in play_js or "data-filter=\"favorites\"" not in play_html:
    fail("PLAY favorites client/filter flow is missing")
if "normalizeFavorites" not in profile_lua or "favorites=normalizeFavorites" not in profile_lua or "if data.favorites~=nil" not in profile_lua:
    fail("PLAY character-persisted favorites profile flow is missing")
if "if data.sound~=nil" not in profile_lua or "if data.reducedMotion~=nil" not in profile_lua:
    fail("profile settings updates must preserve fields omitted by another app")
if 'id="recentCard"' not in play_html or 'id="libraryFilters"' not in play_html or 'id="randomPlay"' not in play_html:
    fail("PLAY library navigation DOM is missing")
if "lastPlayedAt=row.last_played_at" not in play_lua or "MAX(created_at) AS last_played_at" not in play_lua:
    fail("PLAY recent-game statistics timestamp is missing")
if "rankTargets" not in play_js or "rankForScore" not in play_js or "nextRankGoal" not in play_js:
    fail("PLAY rank-goal progression is missing")
if "blockDragTarget" not in play_js or "blockDragGhost" not in play_js or "MEGA BLAST" not in play_js:
    fail("BLOCK drag-first / blast feedback upgrade is missing")
if "PERFECT ×" not in play_js or "maxPerfectStreak" not in play_js or "TOWER" not in play_js:
    fail("TOWER skill-scoring client upgrade is missing")
if "metadata.maxPerfectStreak" not in play_lua or "placementScore" not in play_lua or "replayed.layers" not in play_lua:
    fail("TOWER authoritative scoring upgrade is missing")
if "generateRangeRushRounds" not in play_lua or "rangeRush=true" not in play_lua or "RANGE RUSH" not in play_js:
    fail("RANGE RUSH server-timed skill-game replacement is missing")
if "rangeRushRoundLimit" not in play_lua or "rangeRushPoints" not in play_lua or "highLowLivesRecovery" not in play_lua:
    fail("RANGE RUSH v3 lives/combo/adaptive scoring is missing")
if "highLowTimerFill" not in play_js or "highLowLives" not in play_js or "LIFE -1" not in play_js:
    fail("RANGE RUSH v3 time-pressure/lives UI loop is missing")
if not re.search(r"id='high_low'[^\n]*name='RANGE RUSH'[^\n]*version=3", registry):
    fail("RANGE RUSH v3 registry/version marker is missing")
if "score=score+(gained*chain)" not in play_lua or "merge.chain" not in play_js or "CHAIN ×" not in play_js:
    fail("MERGE chain multiplier scoring is missing")
if not re.search(r"id='merge'[^\n]*version=2", registry):
    fail("MERGE save version must be 2 for chain scoring")
if "dailyStreak" not in play_lua or "nextCount" not in play_lua:
    fail("PLAY Daily streak derivation is missing")
if "generateSortBoard" not in play_lua or "replaySortState" not in play_lua or "INVALID_SORT_REPLAY" not in play_lua:
    fail("SORT deterministic replay engine is missing")
challenge_section = re.search(r"local function challengeFor\(game,seed\)(.*?)local function currentDatabaseDate", play_lua, re.S)
if not challenge_section or "INVALID_SORT_REPLAY" in challenge_section.group(1) or "session.seed" in challenge_section.group(1):
    fail("SORT replay validation is incorrectly placed inside challenge generation")
submit_section = re.search(r"function FlecityGamesPlay\.SubmitScore\(source,data\)(.*?)function FlecityGamesPlay\.Ranking", play_lua, re.S)
if not submit_section or "elseif game.id=='sort'" not in submit_section.group(1) or "metadata.movePenaltyMs=movePenalty" not in submit_section.group(1):
    fail("SORT final replay validation is missing from score submission")
if "openSort" not in play_js or "persistSort" not in play_js or "sortBoard" not in play_js:
    fail("SORT resumable client flow is missing")
if not re.search(r"id='sort'[^\n]*supportsResume=true[^\n]*version=1", registry):
    fail("SORT registry/resume marker is missing")
if "replayFallState" not in play_lua or "FALL_BASE_SHAPES" not in play_lua or "INVALID_FALL_REPLAY" not in play_lua:
    fail("FALL deterministic replay engine is missing")
if "fallReplayEmpty" not in play_lua or "fallReplayMove" not in play_lua or "fallValidateScore" not in play_lua:
    fail("FALL server selftest coverage is missing")
if "openFall" not in play_js or "persistFall" not in play_js or "finishFall" not in play_js or "dropFall" not in play_js:
    fail("FALL resumable client flow is missing")
if not re.search(r"id='fall'[^\n]*supportsResume=true[^\n]*rankingOrder='desc'[^\n]*version=2", registry):
    fail("FALL v2 registry/resume marker is missing")
if 'id="fallGame"' not in play_html or 'id="fallBoard"' not in play_html or 'id="fallFinish"' not in play_html:
    fail("FALL game DOM is missing")
if "FallMasterLines = 20" not in config or "fall_master" not in play_lua or "fall_master" not in play_js:
    fail("FALL MASTER achievement flow is missing")
if "fallPeekPieces" not in play_js or "pieceRngState" not in play_js or 'id="fallNext"' not in play_html:
    fail("FALL deterministic next-piece preview is missing")
if "game.pieces%3===0" not in play_js or "persistFall(false,false)" not in play_js or "snapshotLength" not in play_js:
    fail("FALL non-blocking autosave flow is missing")
if "normalized[#normalized+1]={x=applied.x,rotation=applied.rotation,hold=useHold}" not in play_lua or "game.history.push({x:game.x,rotation:game.rotation,hold:game.holdUsed===true})" not in play_js:
    fail("FALL compact long-run history format is missing")
if "level=math.min(8,1+math.floor" not in play_lua or "LEVEL ×'+applied.level" not in play_js:
    fail("FALL level multiplier scoring is missing")
if "icons/fall.svg" not in play_js:
    fail("FALL dedicated icon wiring is missing")

if "generateSlideBoard" not in play_lua or "replaySlideState" not in play_lua or "INVALID_SLIDE_REPLAY" not in play_lua:
    fail("SLIDE deterministic replay engine is missing")
if "slideSeedBoard" not in play_lua or "slideReplaySolve" not in play_lua or "slideValidateTime" not in play_lua:
    fail("SLIDE server selftest coverage is missing")
if "openSlide" not in play_js or "persistSlide" not in play_js or "finishSlide" not in play_js or "slideBoard" not in play_js:
    fail("SLIDE resumable client flow is missing")
if not re.search(r"id='slide'[^\n]*supportsResume=true[^\n]*rankingOrder='asc'[^\n]*version=1", registry):
    fail("SLIDE registry/resume marker is missing")
if not re.search(r"id='slide'[^\n]*supportsDaily=true", registry):
    fail("SLIDE registry Daily marker is missing")
if not re.search(r"DailyCandidates\s*=\s*\{[^\n]*'slide'[^\n]*\}", config):
    fail("SLIDE must be included in the Daily candidate rotation")
if "DailyCandidates = {'block','mines','quick_tap','nonogram','simon','memory','stop','slide','number_rush','sort','color_match'}" not in config:
    fail("PLAY Daily candidate category-balanced rotation is missing")
if "DAILY_MONTH_OFFSETS" not in play_lua or "dailyLeapYear" not in play_lua or "dailyNextMonth==dailyMonthEnd+1" not in play_lua or "dailyLeapAfter==dailyLeapDay+1" not in play_lua:
    fail("PLAY Daily calendar-day rotation guard is missing")
if "openSlide(true,true)" not in play_js or "slideGame&&slideGame.daily" not in play_js or "daily:daily===true" not in play_js:
    fail("SLIDE Daily client lifecycle is missing")
if "SlideMasterMs = 90000" not in config or "SlideMasterMoves = 120" not in config:
    fail("SLIDE MASTER thresholds are missing")
if "metadata.timeMs" not in play_lua or "metadata.moves" not in play_lua or "slide_master" not in play_lua or "slide_master" not in play_js:
    fail("SLIDE MASTER achievement flow is missing")
play_css = read("flecity_games/web/shared/app.css")
if re.search(r"(?<![A-Za-z0-9_-])-?\d*\.?\d+px\b", play_css):
    fail("shared app CSS contains px units; fixBlur requires rem/em-compatible CSS")
if re.search(r"(?:^|[}\s])(?:html|:root)\s*\{[^}]*font-size\s*:", play_css, re.MULTILINE):
    fail("html/:root font-size must remain unset so LB Phone fixBlur can control scaling")
if 'name="viewport"' in play_html or 'name="viewport"' in party_html:
    fail("PLAY/PARTY must not override the LB Phone custom-app viewport when fixBlur is enabled")
if "LB Phone native fixBlur scaling pass v7" not in play_css:
    fail("LB Phone native fixBlur scaling guard is missing")
if "PLAY fun & feedback pass v8" not in play_css or ".rush-flow" not in play_css or ".memory-streak" not in play_css:
    fail("PLAY gameplay feedback v8 CSS is missing")
if "Rush-mode gameplay v14" not in play_css or ".rush-shift" not in play_css:
    fail("rush-mode gameplay v14 CSS is missing")
if "flagMineDirect" not in play_js or "crossNonogramDirect" not in play_js or "mineSuppressClickUntil" not in play_js or "nonogramSuppressClickUntil" not in play_js:
    fail("PLAY long-press puzzle controls are missing")
if "FLAG LIMIT" not in play_js or "flagsLeft" not in play_js or "旗は地雷数まで" not in play_html:
    fail("MINES flag-budget feedback is missing")
if "PLAY touch puzzle controls v9" not in play_css or ".flag-pop" not in play_css or ".cross-pop" not in play_css:
    fail("PLAY touch puzzle control CSS is missing")
if "chordMine" not in play_js or "CHORD OPEN" not in play_js:
    fail("MINES chord-open mastery mechanic is missing")
if "nonogramLineSolved" not in play_js or "LINE COMPLETE" not in play_js:
    fail("NONOGRAM line-completion feedback is missing")
if "undoSortMove" not in play_js or 'id="sortUndo"' not in play_html:
    fail("SORT undo mechanic is missing")
if "slideStars" not in play_js or "ALIGN +" not in play_js:
    fail("SLIDE par/alignment mastery feedback is missing")
if "sortPourCount" not in play_js or "QUICK POUR ×" not in play_js or ".sort-board.sort-pour" not in play_css:
    fail("SORT quick-pour tempo feedback is missing")
if "slideMovePath" not in play_js or "CHAIN SLIDE ×" not in play_js:
    fail("SLIDE line-slide tempo controls are missing")
if "RANK SCORE" not in play_js or "+0.35秒" not in play_html or "+0.20秒" not in play_html:
    fail("SORT/SLIDE ranking-score explanation is missing")
if "Puzzle mastery feedback v16" not in play_css or "Puzzle quality-of-life v17" not in play_css:
    fail("puzzle mastery visual passes are missing")
if "difficulty=gap<=8?'TIGHT'" not in play_js or "difficultyBonus" not in play_js or "RANGE RUSH risk readability v10" not in play_css:
    fail("RANGE RUSH visible risk/bonus feedback is missing")
if "blockPressure" not in play_js or "mergePressure" not in play_js or "fallPressure" not in play_js:
    fail("PLAY long-run pressure feedback helpers are missing")
if "fallSwipeSteps" not in play_js or "Math.round(Math.abs(Number(dx)||0)/cellWidth)" not in play_js:
    fail("FALL touch swipe scaling is missing")
if "fallGravityDelay" not in play_js or "fallGravityTick" not in play_js or "startFallGravity" not in play_js or "fall-grounded" not in play_css:
    fail("FALL automatic gravity loop is missing")
if "fallPeekPieces" not in play_js or "fallSoft" not in play_js or "startFallSoftDrop" not in play_js or "NEXT 3" not in play_html:
    fail("FALL soft drop / NEXT queue is missing")
if ".fall-preview-cell.filled{background:currentColor" not in play_css or "width:min(100%,14rem)" not in play_css:
    fail("FALL preview contrast / enlarged board visual pass is missing")
if "holdFallPiece" not in play_js or 'id="fallHold"' not in play_html or "fallHoldReplay" not in play_lua or "heldPiece=heldPiece or 0" not in play_lua:
    fail("FALL HOLD replay/UI is missing")
if "DROP '+gravity+'s" not in play_js or "HARD DROP" not in play_html:
    fail("FALL gravity speed/control feedback is missing")
if "CLUTCH ESCAPE" not in play_js or "CHAIN BREAK" not in play_js or "QUAD CLEAR" not in play_js or "SO CLOSE" not in play_js:
    fail("PLAY mastery/clutch feedback is missing")
if "PLAY depth feedback v12" not in play_css or ".block-danger" not in play_css or ".merge-danger" not in play_css or ".fall-danger" not in play_css or ".tower-danger" not in play_css:
    fail("PLAY depth feedback CSS is missing")
if "Endless clutch escape feedback v19" not in play_css or ".block-clutch" not in play_css or ".merge-clutch" not in play_css or ".fall-clutch" not in play_css:
    fail("PLAY endless clutch escape visual feedback is missing")
if "STOP RUSH progression v13" not in play_css or "dataset.tier" not in play_js:
    fail("STOP RUSH escalating visual feedback is missing")
if "QUICK TAP FOCUS v15" not in play_css or "#tapRunMeta" not in play_css:
    fail("QUICK TAP FOCUS visual feedback is missing")
if "personalBestGainText" not in play_js or "PB +" not in play_js:
    fail("PLAY personal-best gain feedback is missing")
if "liveRankUpPrefix" not in play_js or "RANK UP " not in play_js:
    fail("PLAY live rank-up feedback is missing")
if "stop:{order:'desc',S:16000,A:8000,B:3500}" not in play_js:
    fail("STOP RUSH cumulative rank thresholds are stale")
if "period5<period1" not in play_lua or "zone5<zone1" not in play_lua:
    fail("STOP RUSH escalation self-test is missing")
if "STOP!でBULLSEYEを1回" not in play_js:
    fail("STOP BULLSEYE achievement label is stale")
if "NUMBER RUSHをノーミス16秒以内" not in play_js or "NumberRushAceMs = 16000" not in config or "cfg.NumberRushAceMs or 16000" not in play_lua:
    fail("NUMBER ACE displayed/server threshold mismatch")
if "COLOR MATCHをノーミス14秒以内" not in play_js or "ColorMatchFocusMs = 14000" not in config or "cfg.ColorMatchFocusMs or 14000" not in play_lua:
    fail("COLOR FOCUS displayed/server threshold mismatch")
if "version '0.70.0-test'" not in fx:
    fail("PLAY manifest version must be 0.70.0-test")
if "word-break:break-word" not in play_css:
    fail("PLAY narrow-phone status wrapping guard is missing")
if "resetTransientInputState" not in play_js or "clearInterval(highLowClock)" not in play_js:
    fail("PLAY transition cleanup guard is missing")
if "LB Phone status-bar clearance & runtime badge v11" not in play_css:
    fail("PLAY LB Phone status-bar clearance CSS is missing")
if "if(inGame){statusEl.textContent='';statusEl.className='status app-status hidden';return;}" not in play_js or "body.game-active .app-status{display:none!important}" not in play_css:
    fail("PLAY shared status bar must stay hidden during gameplay")
if "stackCameraTarget" not in play_js or "cameraOffset" not in play_js or 'data-camera="follow"' not in play_css:
    fail("TOWER follow camera is missing")
if "dropStackBlock" not in play_js or "stackArena.onclick" not in play_js or 'aria-label="TOWER: タップでDROP"' not in play_html:
    fail("TOWER direct-tap DROP control is missing")
if "layerCount)||0)-5" not in play_js:
    fail("TOWER camera follow threshold is too late")
if "html,body,.wrap{scrollbar-width:none" not in play_css or "html::-webkit-scrollbar" not in play_css:
    fail("PLAY native phone scrollbar suppression is missing")
if "PLAY submission home visual pass v24" not in play_css or "home-scroll-row" not in play_css or "home-utility-label" not in play_html or 'class="home-top-safe"' not in play_html:
    fail("PLAY submission home visual pass is missing")
if "enableHorizontalDragScroll" not in play_js or "touch-action:pan-y" not in play_css or "is-dragging" not in play_css:
    fail("PLAY home horizontal drag scrolling is missing")
if "continueGames.scrollLeft=0;recentGames.scrollLeft=0;" not in play_js:
    fail("PLAY home strip reset is missing")
if 'class="home-top-safe"' not in play_html or ".home-top-safe{height:3rem" not in play_css or '<header class="header app-header">' in play_html or 'id="runtimeVersion"' in play_html:
    fail("PLAY clean notch-safe home top is missing")
if "PLAY clarity & dedicated icon pass v3" not in play_css or ".game-icon img" not in play_css or ".daily-game-icon" not in play_css:
    fail("PLAY clarity/icon v3 CSS is missing")
if "PLAY library navigation pass v4" not in play_css or ".library-filter.active" not in play_css or ".recent-feature" not in play_css:
    fail("PLAY library navigation v4 CSS is missing")
if "PLAY favorites pass v5" not in play_css or ".favorite-toggle.active" not in play_css:
    fail("PLAY favorites v5 CSS is missing")
if "/* FALL endless */" not in play_css or ".fall-board" not in play_css or '.game[data-game="fall"]' not in play_css:
    fail("FALL visual CSS is missing")
if "/* SLIDE puzzle */" not in play_css or ".slide-board" not in play_css or '.game[data-game="slide"]' not in play_css:
    fail("SLIDE visual CSS is missing")
for marker in ("PLAY visual quality pass v2","game-card-top","tile-2048","memory-flip","simon-board[data-phase","RANGE RUSH","MERGE chain scoring"):
    if marker not in play_css:
        fail(f"PLAY visual quality marker missing: {marker}")
if " · BEST '+personalBestText(" in play_js:
    fail("PLAY meta rows must not duplicate dedicated BEST labels")
if "requestEpoch" not in play_lua or "SAVE_RESET_FAILED" not in play_lua:
    fail("PLAY reset failure recovery / in-flight save epoch snapshot is missing")
if "minesFirstRevealSafe" not in play_lua or "avoidIndex" not in play_lua or "avoidIndex" not in play_js:
    fail("first-safe MINES flow is missing")
if not re.search(r"id='mines'[^\n]*version=2", registry):
    fail("MINES save version must be 2 for first-safe boards")
if "NONOGRAM_PATTERNS_5" not in play_lua or "NONOGRAM_PATTERNS_5" not in play_js or "nonogramCuratedSet" not in play_lua:
    fail("curated NONOGRAM puzzle set is missing")
if "タップで塗る・長押しで×" not in play_js or "nonogram.crossed.delete(index);nonogram.filled.add(index)" not in play_js:
    fail("NONOGRAM touch/hold input separation is missing")
try:
    client_nonogram = play_js.split("const NONOGRAM_PATTERNS_5=[",1)[1].split("];",1)[0]
    server_nonogram = play_lua.split("local NONOGRAM_PATTERNS_5={",1)[1].split("\n}",1)[0]
    client_patterns = re.findall(r"\['([01]{5})','([01]{5})','([01]{5})','([01]{5})','([01]{5})'\]", client_nonogram)
    server_patterns = re.findall(r"\{'([01]{5})','([01]{5})','([01]{5})','([01]{5})','([01]{5})'\}", server_nonogram)
    if len(client_patterns) != 30 or client_patterns != server_patterns or "nonogramCuratedSet=#NONOGRAM_PATTERNS_5==30" not in play_lua:
        fail("NONOGRAM curated library must contain 30 synchronized puzzles")
except (IndexError, ValueError):
    fail("NONOGRAM curated puzzle library could not be parsed")
if not re.search(r"id='nonogram'[^\n]*version=2", registry):
    fail("NONOGRAM save version must be 2 for curated puzzles")
if "replayMemory" not in play_lua or "memoryDeckPairs" not in play_lua:
    fail("MEMORY server replay/selftest is missing")
if "movePenaltyMs=movePenalty" not in play_lua or "MOVE PENALTY" not in play_js:
    fail("MEMORY move-accuracy scoring is missing")
if "PERFECT MEMORY" not in play_js or "memory-perfect" not in play_css or "MEMORY perfect-clear feedback v20" not in play_css:
    fail("MEMORY perfect-clear feedback is missing")
if not re.search(r"id='memory'[^\n]*version=2", registry):
    fail("MEMORY FOCUS registry version must be 2")
if "previewMs=1200" not in play_lua or "memoryPreviewConfigured" not in play_lua:
    fail("MEMORY preview-time scoring guard is missing")
if "replayColorMatch" not in play_lua or "colorMatchReplay" not in play_lua:
    fail("COLOR MATCH server replay/selftest is missing")
if not re.search(r"id='color_match'[^\n]*supportsDaily=true", registry):
    fail("COLOR MATCH registry Daily marker is missing")
if not re.search(r"DailyCandidates\s*=\s*\{[^\n]*'color_match'[^\n]*\}", config):
    fail("COLOR MATCH must be included in the Daily candidate rotation")
if "openColorMatch(true)" not in play_js or "daily=colorMatchEl.dataset.daily==='1'" not in play_js or "daily:session.daily===true" not in play_js:
    fail("COLOR MATCH Daily client lifecycle is missing")
if "replayNumberRush" not in play_lua or "numberRushReplay" not in play_lua:
    fail("NUMBER RUSH server replay/selftest is missing")
if "replayHighLow" not in play_lua or "highLowReplay" not in play_lua:
    fail("HIGH & LOW server replay/selftest is missing")
if "HighLowGuess" not in play_lua or "highLowServerState" not in play_lua or "serverAuthoritative=true" not in play_lua:
    fail("HIGH & LOW server-authoritative state validation is missing")
if "lastStep" not in play_lua or not re.search(r"step\s*=\s*(?:highLow|game)\.completed\s*\+\s*1", play_js):
    fail("HIGH & LOW idempotent action numbering is missing")
if "replaySimon" not in play_lua or "simonReplay" not in play_lua:
    fail("SIMON server replay/selftest is missing")
if "SPEED '+speedStage" not in play_js or "SIMON SPEED UP" not in play_js:
    fail("SIMON speed-stage progression is missing")
if not re.search(r"id='simon'[^\n]*version=2", registry):
    fail("SIMON speed-stage registry version must be 2")
if "SubmitSimonRound" not in play_lua or "simonServerState" not in play_lua:
    fail("SIMON server-authoritative round validation is missing")
if "lastRound" not in play_lua or "sendSimonRound(inputs,round)" not in play_js:
    fail("SIMON idempotent round numbering is missing")

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
if "reclaimDisconnectedCapacity" not in party_lua or "connectedCount(room)<FlecityGamesConfig.Party.MaxPlayers" not in party_lua:
    fail("PARTY disconnected-slot reclaim is missing")
if "now-disconnectedAt>grace" not in party_lua:
    fail("PARTY disconnected-slot reclaim must preserve reconnect grace")
if party_lua.find("if room.state~='lobby' then return {ok=false,error='ROUND_IN_PROGRESS'} end") > party_lua.find("reclaimDisconnectedCapacity(room,FlecityGamesConfig.Party.MaxPlayers)"):
    fail("PARTY join must reject live rounds before capacity mutation")
if "room.state=='lobby' then member.ready=false end" not in party_lua or "room.state=='lobby' then m.ready=false end" not in party_lua:
    fail("PARTY lobby ready reset on disconnect/reconnect is missing")
if "strokePointCount(rs.strokes)+#clean[1]>3200" not in party_lua or "sanitizedStrokes(data.strokes,80,2400)" not in party_lua:
    fail("PARTY drawing payload limits are missing")
if "partyOnOpen" not in client or "partyOnClose" not in client or "partyPushSuspended" not in client:
    fail("PARTY LB Phone lifecycle gating is missing")
if "partySuspend" not in party_js or "partyResume" not in party_js or "appSuspended" not in party_js:
    fail("PARTY UI suspend/resume cleanup is missing")
if "if(appSuspended)return;" not in party_js:
    fail("PARTY suspended NUI must ignore delayed push events")
if "lifecycleEpoch" not in party_js or party_js.count("epoch!==lifecycleEpoch") < 4 or "if(appSuspended||!room)return false;" not in party_js:
    fail("PARTY async responses must be lifecycle-epoch guarded")
if "visibilityBound" not in party_js or "function bindVisibilityLifecycle()" not in party_js:
    fail("PARTY visibility lifecycle listener must bind only once")
if "clearTimeout(statusTimer);statusTimer=null" not in party_js:
    fail("PARTY suspend must clear status timer")
if "actionLocks" not in party_js or "runOnce('start'" not in party_js:
    fail("PARTY client action de-duplication is missing")
if "drawStroke=null;drawIsDrawer=false;telephoneStroke=null;telephoneStrokes=[]" not in party_js:
    fail("PARTY round runtime cleanup is incomplete")
if "roundTimeoutSeconds" not in party_lua or "deadlineTick" not in party_lua or "TURN_TIMEOUT" not in party_lua or "ROUND_TIMEOUT" not in party_lua:
    fail("PARTY authoritative round timeout is missing")
if "deadlineLoop" not in party_js or "roundDeadline" not in party_js or 'id="roundDeadline"' not in party_html:
    fail("PARTY round deadline UI is missing")
if "voteUnlockTick" not in party_lua or "VOTING_LOCKED" not in party_lua or "deductionPhaseLoop" not in party_js:
    fail("PARTY deduction discussion/voting phase separation is missing")
if "out.submittedCount=submitted" not in party_lua or "out.expectedSubmissions=connectedCount(room)" not in party_lua or "submissionProgress" not in party_js:
    fail("PARTY aggregate waiting-progress UI is missing")
if "rotation.ticTac" not in party_lua:
    fail("PARTY TIC-TAC first-player rotation is missing")
if "minorityUnanimousNoWinner" not in party_lua or "noMinority" not in party_lua:
    fail("PARTY MINORITY unanimous-choice handling is missing")
if "FlecityGamesParty.AppClosed" not in party_lua or "flecity_games:server:partyClosed" not in client or "flecity_games:server:partyClosed" not in server:
    fail("PARTY app-close ready cleanup is missing")
if "DebugRoomSummaries" not in party_lua or "game_party_status" not in server:
    fail("PARTY live room diagnostic command is missing")
if "['flecity_games:party:addDrawStroke']={preventSpam=true,rateLimit=75" not in server:
    fail("PARTY DRAW LB Phone callback throttle is too restrictive")
if "handoffHostFrom(room,id)" not in party_lua or "appCloseHostHandoff" not in party_lua:
    fail("PARTY app-close host handoff is missing")
if "local room=roomForSource(source)" not in party_lua or "tonumber(member.source)~=tonumber(source)" not in party_lua:
    fail("PARTY AppClosed must use side-effect-free room lookup")
if "bestHostCandidate" not in party_lua or "m.appOpen~=false" not in party_lua or "member.appOpen=true" not in party_lua:
    fail("PARTY host migration must prefer app-active members")
if "appOpen=m.appOpen~=false" not in party_lua or "アプリ閉じています" not in party_js or "アプリ待ち " not in party_js:
    fail("PARTY lobby must expose app-presence blocking state")
if "m.appOpen==false or m.ready~=true" not in party_lua:
    fail("PARTY server must reject start while a connected member app is closed")
if "if room.state=='lobby' then return {ok=true,room=snapshot(room,id)} end" not in party_lua or "rs.complete~=true" not in party_lua:
    fail("PARTY ReturnLobby idempotency/live-round guard is missing")
if "local roundChanged=reconcileRound(room)" not in party_lua or "if changed or roundChanged then notifyRoom(room) end" not in party_lua:
    fail("PARTY cleanup must push timeout/reconcile state changes")
if "Wait(1000)" not in server or "FlecityGamesParty.Cleanup()" not in server:
    fail("PARTY cleanup cadence must be 1 second for responsive deadlines")
if "Wait(5000)" not in server or "FlecityGamesPlay.Cleanup()" not in server:
    fail("PLAY cleanup cadence changed unexpectedly")
if "rs.gameId=='telephone'" not in party_lua or "forfeit=true" not in party_lua:
    fail("PARTY turn-timeout continuation/forfeit handling is missing")
if "telephoneTurnTimeoutSeconds" not in party_lua or "mode=='text' and 30 or 45" not in party_lua:
    fail("PARTY TELEPHONE mode-specific turn pacing is missing")
if "canvas.width=360;canvas.height=260;canvas.className='draw-canvas'" not in party_js:
    fail("PARTY TELEPHONE result canvas must preserve drawing aspect ratio")
if "function drawableStroke(points)" not in party_js or "const sendPoints=drawableStroke(points)" not in party_js or "const stored=drawableStroke(stroke)" not in party_js:
    fail("PARTY drawing must preserve single-tap dots")
if party_js.count("e.key==='Enter'&&!e.isComposing") < 2:
    fail("PARTY Japanese IME Enter guards are missing")
if "maybeFinishReaction(room,true)" not in party_lua or "maybeFinishDraw(room,true)" not in party_lua or "totalVotes=totalVotes" not in party_lua:
    fail("PARTY timeout partial-result finalization is missing")
if "resultHoldLoop" not in party_js or "resultLobbyUnlockAt=performance.now()+2500" not in party_js:
    fail("PARTY result-screen accidental-return guard is missing")
if "leaveConfirmUntil" not in party_js or "もう一度押して退出" not in party_js or "resetLeaveConfirmation" not in party_js:
    fail("PARTY leave accidental-tap confirmation is missing")
if "appendResultBanner" not in party_js or "WINNER · " not in party_js or "FASTEST · " not in party_js:
    fail("PARTY result winner clarity banners are missing")
if "playersEl.classList.toggle('dense'" not in party_js or "#players.dense" not in play_css:
    fail("PARTY large-room player-list density handling is missing")

for marker in (
    "wordWolfPrivacy",
    "liarPrivacy",
    "drawPrivacy",
    "drawAliasMatch",
    "drawConnectedProgress",
    "telephonePrivacy",
    "telephoneContributorNamePreserved",
    "telephoneDisconnectFreshDeadline",
    "roomRevision",
    "appCloseHostHandoff",
    "reconnectGracePreserved",
    "expiredCapacityReclaimed",
    "disconnectedVoteIgnored",
    "roundAbortLowPlayers",
    "secretRoleDisconnectAbort",
    "minorityAggregation",
    "ticTacWinner",
):
    if marker not in party_lua:
        fail(f"PARTY selftest missing: {marker}")

expected_play_order = ["quick_tap", "stop", "stack", "block", "merge", "fall", "mines", "nonogram", "memory", "sort", "slide", "color_match", "number_rush", "high_low", "simon"]
expected_party_order = ["reaction", "stop_battle", "vote", "majority", "minority", "tic_tac", "word_wolf", "liar", "draw", "telephone", "ng_word", "fake_answer", "bomb", "memory_chain", "fall_battle"]
ordered_defs = re.findall(r"order=(\d+),id='([^']+)'[^\n]*app='(play|party)'", registry)
normalized_defs = sorted((int(order), game_id, app) for order, game_id, app in ordered_defs)
play_order = [game_id for _, game_id, app in normalized_defs if app == "play"]
party_order = [game_id for _, game_id, app in normalized_defs if app == "party"]
if play_order != expected_play_order:
    fail(f"PLAY registry order mismatch: {play_order}")
if party_order != expected_party_order:
    fail(f"PARTY registry order mismatch: {party_order}")
if not re.search(r"id='reaction'[^\n]*maxPlayers=10", registry) or not re.search(r"id='stop_battle'[^\n]*maxPlayers=10", registry):
    fail("PARTY quick simultaneous games must support 10-player rooms")

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
submission_builder = read("flecity_games/tools/build_submission.py")
submission_install = read("flecity_games/release_docs/INSTALL_JA.txt")
submission_checklist = read("flecity_games/release_docs/OPERATOR_CHECKLIST_JA.txt")
party_submission_builder = read("flecity_games/tools/build_party_submission.py")
party_submission_install = read("flecity_games/release_docs/PARTY_INSTALL_JA.txt")
party_submission_checklist = read("flecity_games/release_docs/PARTY_OPERATOR_CHECKLIST_JA.txt")
if 'RELEASE_VERSION = "1.0.0"' not in submission_builder or '"server/core/dev_reload.lua"' not in submission_builder or 'flecity-games-loop-' not in submission_builder or 'web/play/icon.svg' not in submission_builder:
    fail("submission builder LOOP release branding/dev exclusion is missing")
if '"web/party"' not in submission_builder or "enabled = false" not in submission_builder:
    fail("submission builder PARTY-disable packaging is missing")
if "ensure flecity_games" not in submission_install or "SQLの手動実行は不要" not in submission_install or "App Store" not in submission_install:
    fail("operator submission install guide is incomplete")
if "PARTYカスタムアプリは無効化" not in submission_checklist or "defaultApp=false / price=0" not in submission_checklist:
    fail("operator submission checklist does not describe LOOP App Store build")

party_config_match = re.search(r"Party\s*=\s*\{(.*?)\n        \}", config, flags=re.S)
party_config_block = party_config_match.group(1) if party_config_match else ""
for required_marker in ("identifier = 'flecity_party'", "name = 'PARTY'", "defaultApp = false", "game = true", "price = 0"):
    if required_marker not in party_config_block:
        fail(f"PARTY App Store config missing: {required_marker}")
if 'PARTY_RELEASE_VERSION = "1.0.0"' not in party_submission_builder or 'RESOURCE_RELEASE_VERSION = "1.1.0"' not in party_submission_builder:
    fail("PARTY submission builder versioning is missing")
if "flecity-games-party-" not in party_submission_builder or '"server/core/dev_reload.lua"' not in party_submission_builder or "web/party/icon.svg" not in party_submission_builder:
    fail("PARTY submission builder packaging markers are missing")
if "PARTY" not in party_submission_install or "restart flecity_games" not in party_submission_install or "SQLの手動実行は不要" not in party_submission_install:
    fail("PARTY operator install guide is incomplete")
if "defaultApp=false" not in party_submission_checklist or "game=true" not in party_submission_checklist or "price=0" not in party_submission_checklist:
    fail("PARTY operator checklist does not describe App Store build")

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
