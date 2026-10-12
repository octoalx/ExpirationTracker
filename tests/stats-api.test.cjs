const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const dateFns = require("date-fns");
function load(file, modules, Clock = Date) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, Date: Clock, require(name) { if (!(name in modules)) { const offline = require("./helpers/offline-modules.cjs"); if (name in offline) return offline[name]; throw new Error(`Unexpected dependency: ${name}`); } return modules[name]; } });
  return exports;
}
const overview = load("src/lib/expiry-overview.ts", { "date-fns": dateFns }).expiryOverview;
const record = (id, status, expiryDate) => ({ id, name: id, barcode: "0123456789012", status, expiryDate, quantity: null, createdAt: new Date(Date.UTC(2026, 9, 2)) });
test("expiry overview uses calendar days, exact thresholds and active records only", () => {
  const now = new Date("2026-10-02T23:59:00+03:00");
  const products = [record("expired", "ACTIVE", new Date(Date.UTC(2026, 9, 1))), record("today", "ACTIVE", new Date(Date.UTC(2026, 9, 2))), record("urgent", "ACTIVE", new Date(Date.UTC(2026, 9, 5))), record("warning", "ACTIVE", new Date(Date.UTC(2026, 9, 9))), record("safe", "ACTIVE", new Date(Date.UTC(2026, 9, 10))), record("unknown", "ACTIVE", null), record("archive", "ARCHIVED", new Date(Date.UTC(2026, 8, 1))), record("defect", "DEFECT", null)];
  const result = overview(products, now, 3, 7);
  assert.equal(JSON.stringify(result.counts), JSON.stringify({ expired: 1, urgent: 2, warning: 1, safe: 1, unknown: 1 }));
  assert.equal(result.dated[1].daysLeft, 0);
  assert.deepEqual(Array.from(result.unknown, p => p.id), ["unknown"]);
  assert.equal(overview([], now, 0, 0).dated.length, 0);
});
test("statistics API rejects anonymous reads, scopes ownership and serializes null expiry safely", async () => {
  const fixed = new Date("2026-10-02T23:59:00+03:00");
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [fixed.getTime()])); } }
  let session = null;
  const scopes = [];
  const handler = load("src/pages/api/user/stats.ts", {
    "next-auth": { getServerSession: async () => session }, "@/lib/auth": { authOptions: {} }, "date-fns": dateFns,
    "@/lib/expiry-overview": { expiryOverview: overview },
    "@/lib/apiErrorHandler": { apiErrorHandler: error => { throw error; } },
    "@/lib/prisma": { prisma: { storeMembership: { findUnique: async () => null },
      settings: { findUnique: async args => { scopes.push(args.where.userId); return { urgentThreshold: 0, warningThreshold: 7 }; } },
      product: { findMany: async args => { scopes.push(args.where.userId); return [record("missing", "ACTIVE", null), record("today", "ACTIVE", new Date(Date.UTC(2026, 9, 2))), record("archive", "ARCHIVED", new Date(Date.UTC(2026, 8, 1)))]; } },
      emailLog: { findMany: async args => { scopes.push(args.where.userId); return []; } },
    } },
  }, Clock).default;
  const call = async method => { const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } }; await handler({ method, query: { userId: "other" } }, res); return res; };
  assert.equal((await call("POST")).code, 405);
  assert.equal((await call("GET")).code, 401);
  assert.equal(scopes.length, 0);
  session = { user: { id: "owner" } };
  const response = await call("GET");
  assert.equal(response.code, 200);
  assert.deepEqual(scopes, ["owner", "owner", "owner"]);
  assert.equal(response.data.unknownExpiryCount, 1);
  assert.equal(response.data.expiredCount, 0);
  assert.equal(response.data.urgentCount, 1);
  assert.equal(response.data.urgentThreshold, 0);
  assert.equal(response.data.problemProducts[0].daysLeft, 0);
  assert.equal(response.data.nearestExpiry.id, "today");
  assert.equal(response.data.productsAddedByDay.length, 30);
});
