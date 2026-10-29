// Lightweight static regression guard; not a substitute for FiveM / MariaDB tests.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const main = readFileSync(join(root, "server/main.lua"), "utf8");
const manifest = readFileSync(join(root, "fxmanifest.lua"), "utf8");
const config = readFileSync(join(root, "config.lua"), "utf8");
const database = readFileSync(join(root, "server/database.lua"), "utf8");
const schema = readFileSync(join(root, "sql/schema.sql"), "utf8");

function handler(name) {
  const open = "handlers." + name + " = function(";
  const start = main.indexOf(open);
  assert(start >= 0, "Missing handler: " + name);
  assert.equal(main.indexOf(open, start + 1), -1, "Duplicate handler: " + name);
  const next = main.indexOf("\nhandlers.", start + 1);
  return main.slice(start, next < 0 ? main.length : next);
}
function requires(pattern, body, message) {
  assert.match(body, pattern, message);
}

const create = handler("stockCreate");
const adjust = handler("stockAdjust");
const invite = handler("workspaceInvite");
const accept = handler("inviteAccept");

for (const [name, body] of Object.entries({ stockCreate: create, stockAdjust: adjust, workspaceInvite: invite, inviteAccept: accept })) {
  requires(/MySQL\.startTransaction\(function\(query\)/, body, name + " is not atomic");
  requires(/return false/, body, name + " cannot roll back");
}
requires(/FOR UPDATE/, adjust, "stockAdjust must lock the inventory row");
requires(/affectedRows/, adjust, "stockAdjust must verify UPDATE and history INSERT");
requires(/flecity_base_stock_movements/, create, "initial stock history is missing");
requires(/flecity_base_stock_movements/, adjust, "adjustment history is missing");
requires(/FOR UPDATE/, invite, "workspaceInvite must lock the workspace row");
requires(/FOR UPDATE/, accept, "inviteAccept must lock the workspace row");
requires(/INSERT INTO flecity_base_members/, accept, "inviteAccept must create a membership inside the transaction");
requires(/status='accepted'/, accept, "inviteAccept must update invitation status");
requires(/stock_txn/, main, "selftest must check oxmysql transaction API");
requires(/QBCore:Server:OnPlayerUnload/, main, "WEAZEL session must clear when a character unloads");
requires(/QBCore:Server:OnJobUpdate/, main, "WEAZEL session must clear after job updates");
requires(/row\.global_access = ctx\.globalMode and 1 or 0/, main, "global maintenance role was lost for joined BASEs");

const icon = config.match(/icon\s*=\s*'([^']+)'/);
assert(icon, "BASE app icon is not configured");
assert(existsSync(join(root, icon[1])), "Configured app icon is missing: " + icon[1]);
assert.match(manifest, /@oxmysql\/lib\/MySQL\.lua/, "oxmysql helper is not included");
for (const table of ["flecity_base_stock_items", "flecity_base_stock_movements", "flecity_base_invites"]) {
  assert(database.includes("CREATE TABLE IF NOT EXISTS " + table), "Missing auto-created table: " + table);
  assert(schema.includes("CREATE TABLE IF NOT EXISTS " + table), "Missing SQL reference table: " + table);
}
console.log("BASE source regression guards: PASS");
