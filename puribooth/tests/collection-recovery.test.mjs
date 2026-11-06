import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../server/main.lua', import.meta.url), 'utf8');
const config = await readFile(new URL('../config.lua', import.meta.url), 'utf8');
const install = await readFile(new URL('../INSTALL.md', import.meta.url), 'utf8');
const manifest = await readFile(new URL('../fxmanifest.lua', import.meta.url), 'utf8');

function blockBetween(start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `missing source marker: ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(to, -1, `missing source end marker: ${end}`);
  return source.slice(from, to);
}

test('safeAuditDetail is local before the first call site', () => {
  const declaration = source.indexOf('local function safeAuditDetail');
  const firstCall = source.indexOf('safeAuditDetail(', source.indexOf('local function transitionCollection'));
  assert.notEqual(declaration, -1);
  assert.notEqual(firstCall, -1);
  assert.ok(declaration < firstCall);
  assert.match(source.slice(declaration, firstCall), /detail:sub\(1, 255\)/);
});

test('payout and recovery command handlers share a mutual exclusion guard', () => {
  const payout = blockBetween('local function collectSales', 'local function changeBoothPrice');
  const wrapper = blockBetween('local function withCollectionRecovery', 'local function finalizeCollection');
  const retry = blockBetween('RegisterCommand("puribooth_collection_retry"', 'RegisterCommand("puribooth_collection_review"');
  const review = blockBetween('RegisterCommand("puribooth_collection_review"', 'RegisterCommand("puribooth_refunds"');

  assert.match(payout, /collectionProcessRunning or collectionRecoveryRunning/);
  assert.match(wrapper, /if collectionProcessRunning or collectionRecoveryRunning then/);
  assert.match(wrapper, /collectionRecoveryRunning = true/);
  assert.match(wrapper, /collectionRecoveryRunning = false/);
  assert.match(retry, /withCollectionRecovery\(function\(\)/);
  assert.match(review, /withCollectionRecovery\(function\(\)/);
});

test('retry claims compare status and previous error before using a new token', () => {
  const claim = blockBetween('local function claimCollectionRetry', 'local function retryCollectionFinalize');
  assert.match(claim, /SET\s+status = \?,\s+last_error = \?/);
  assert.match(claim, /AND status = \?/);
  assert.match(claim, /AND last_error <=> \?/);
  assert.match(claim, /if not affected or affected < 1 then/);
});

test('retry transactions condition every booth mutation and ledger close on the same token', () => {
  const finalize = blockBetween('local function retryCollectionFinalize', 'local function retryCollectionRestore');
  const restore = blockBetween('local function retryCollectionRestore', 'local function withCollectionRecovery');
  const transactionHelper = blockBetween('local function collectionTransaction', 'local function collectionRestoreQueries');

  for (const [name, block, state, terminal] of [
    ['finalization', finalize, 'finalizing_retry', 'resolved'],
    ['restoration', restore, 'restoring_retry', 'rolled_back'],
  ]) {
    assert.match(block, /collectionTransaction\(queries\)/, `${name} uses one DB transaction`);
    assert.match(block, new RegExp(`status = '${state}'`), `${name} checks claimed state`);
    assert.match(block, /last_error = \?/i, `${name} checks the recovery token`);
    assert.match(block, new RegExp(`SET status = '${terminal}'`), `${name} closes the ledger atomically`);
    assert.match(block, /return row and tostring\(row\.status or ""\)/, `${name} verifies committed terminal state`);
    assert.doesNotMatch(block, /addCompanyMoney|AddMoney/, `${name} does not call a payout API`);
  }
  assert.match(transactionHelper, /MySQL\.transaction\.await\(queries\)/);
});

test('token compare-and-set model admits only one concurrent retry and a terminal row cannot be reclaimed', () => {
  const row = { status: 'finalizing_retry', token: 'recovery:old' };
  const claim = (expected, next) => {
    if (row.status !== 'finalizing_retry' || row.token !== expected) return false;
    row.token = next;
    return true;
  };
  const close = (token) => {
    if (row.status !== 'finalizing_retry' || row.token !== token) return false;
    row.status = 'resolved';
    row.token = null;
    return true;
  };

  assert.equal(claim('recovery:old', 'recovery:a'), true);
  assert.equal(claim('recovery:old', 'recovery:b'), false);
  assert.equal(close('recovery:b'), false);
  assert.equal(close('recovery:a'), true);
  assert.equal(claim('recovery:a', 'recovery:c'), false);
});

test('recovery command never re-enters the company payout path', () => {
  const retry = blockBetween('RegisterCommand("puribooth_collection_retry"', 'RegisterCommand("puribooth_collection_review"');
  const review = blockBetween('RegisterCommand("puribooth_collection_review"', 'RegisterCommand("puribooth_refunds"');
  assert.doesNotMatch(retry, /addCompanyMoney\s*\(/);
  assert.doesNotMatch(review, /addCompanyMoney\s*\(/);
  assert.match(retry, /retryCollectionFinalize\s*\(/);
  assert.match(retry, /retryCollectionRestore\s*\(/);
});

test('bank providers use separate export contracts and ambiguous payouts stay pending review', () => {
  const payout = blockBetween('local function addCompanyMoney', 'local function showSalesReport');
  const worker = blockBetween('local function collectSales', 'local function changeBoothPrice');

  assert.match(payout, /getAccountMoney\(account\)/);
  assert.match(payout, /addAccountMoney\(account, amount\)/);
  assert.match(payout, /handleTransaction\(/);
  assert.match(payout, /GetAccount\(account\)/);
  assert.match(payout, /AddMoney\(account, amount\)/);
  assert.match(payout, /transactionResource or resource/);
  assert.match(payout, /AddTransaction\(account/);
  assert.match(payout, /if result ~= true then[\s\S]*?return nil, account/);
  assert.match(install, /transactionResource = "okokBankingV2"/);
  assert.match(manifest, /version "1\.0\.7"/);
  assert.match(install, /FLEPURI v1\.0\.7/);
  assert.match(config, /mode = "renewed-banking"/);

  const ambiguous = worker.indexOf('if paid == nil then');
  const definitiveFailure = worker.indexOf('if not paid then', ambiguous);
  assert.ok(ambiguous > -1 && definitiveFailure > ambiguous);
  assert.match(worker.slice(ambiguous, definitiveFailure), /keep paying for manual review/);
  assert.doesNotMatch(worker.slice(ambiguous, definitiveFailure), /restoreCollection\s*\(/);
});
