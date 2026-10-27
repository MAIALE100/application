#!/usr/bin/env python3
"""Static regression checks for WAVE's generated FiveM resource.

Usage: python3 wave-security-smoke.py path/to/wave
No third-party Python packages are required.
"""
from pathlib import Path
import re
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else 'wave-check/wave')
server = (root / 'server/main.lua').read_text(encoding='utf-8')
client = (root / 'client/main.lua').read_text(encoding='utf-8')
app = (root / 'web/app.js').read_text(encoding='utf-8')
css = (root / 'web/app.css').read_text(encoding='utf-8')
config = (root / 'config/shared.lua').read_text(encoding='utf-8')


def body(name):
    match = re.search(r'^local function ' + re.escape(name) + r'\(', server, re.M)
    if not match:
        raise AssertionError(f'Missing server function: {name}')
    next_function = re.search(r'^local function \w+\(', server[match.end():], re.M)
    end = match.end() + next_function.start() if next_function else len(server)
    return server[match.start():end]


def check(label, condition):
    if not condition:
        raise AssertionError(label)
    print('PASS:', label)


server_actions = set(re.findall(r"\['(wave:[A-Za-z]+)'\]\s*=\s*cb\w+", server))
client_actions = set(re.findall(r"=\s*'(wave:[A-Za-z]+)'", client))
check('NUI callback map equals server registrations', server_actions == client_actions and len(server_actions) >= 30)
check('NUI action whitelist and safe callback wrapper',
      "if not callbackName then return cb({ok=false, error='UNKNOWN_ACTION'})" in client
      and 'pcall(fn,source' in server)
check('Admin endpoints enforce authorization',
      all('if not isAdmin(source)' in body(name) for name in
          ('cbAdminOverview', 'cbAdminTrackAction', 'cbAdminArtistAction', 'cbAdminReportAction')))
check('Hidden creator identity removed from public tracks',
      'row.creator_citizenid = nil' in body('normalizeTrack'))
check('Purchase debits bank and atomically writes WAVE ledger',
      all(token in body('cbPurchaseTrack') for token in
          ("RemoveMoney('bank'", 'MySQL.transaction.await',
           "INSERT INTO wave_purchases", 'wave_platform_wallet', "AddMoney('bank'")))
check('Creator withdrawal uses balance compare-and-swap and compensating rollback',
      all(token in body('cbWithdraw') for token in
          ('balance=? AND frozen=0', "AddMoney('bank'", 'balance=balance+?', 'WALLET_FROZEN')))
check('Publication requires rights, active artist and normalized project',
      all(token in body('cbPublishTrack') for token in
          ('rightsConfirmed', 'getArtist(citizenid)', 'encodeProject(', 'PUBLISH_DB_FAILED')))
check('Owner release management blocks suspended tracks',
      all(token in body('cbUpdateOwnTrack') for token in
          ("row.status == 'suspended'", 'artist_id=?', "artist.status ~= 'active'")))
check('Public tracks only show active artists and public releases',
      "t.status='public' AND a.status='active'" in body('publicTracks'))
check('Schema version and diagnostic endpoint exist',
      'SchemaVersion = 3' in config and 'wave_schema_meta' in server and 'wave_selftest' in server)
check('Blocking browser dialogs are absent',
      not re.search(r'\b(?:prompt|confirm)\s*\(', app))
check('LB Phone fixBlur-compatible CSS',
      not re.search(r'(?<![A-Za-z0-9_-])-?\d*\.?\d+px\b', css))
print('WAVE security smoke: PASS')
