// Load real pure/server services without importing application startup or live clients.
const inventory = require('../../src/lib/server/inventory.ts');
const calendar = require('../../src/lib/expiry-calendar.ts');
module.exports = {
  '@/lib/server/inventory': inventory,
  '@/lib/server/api': require('../../src/lib/server/errors.ts'),
  '@/lib/server/store-backup': require('../../src/lib/server/store-backup.ts'),
  '@/lib/server/snapshot-restore': require('../../src/lib/server/snapshot-restore.ts'),
  '@/lib/server/sqlite-snapshot': require('../../src/lib/server/sqlite-snapshot.ts'),
  '@/lib/server/telegram-runtime': { suspendTelegram: () => true, resumeTelegramRuntime() {} },
  '@/lib/expiry-calendar': calendar,
  './expiry-calendar': calendar,
};
