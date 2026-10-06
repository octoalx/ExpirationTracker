import { Telegram } from 'telegraf';
import { setupTelegram } from './lib/telegram-setup.mjs';

// Node 22 provides environment loading without a development-only dependency.
try { process.loadEnvFile(); }
catch (error) {
  if (error.code !== 'ENOENT') {
    console.error('Unable to read the environment file. Check file access and formatting.');
    process.exit(1);
  }
}

process.exitCode = await setupTelegram({
  env: process.env,
  args: process.argv.slice(2),
  transport: token => new Telegram(token),
});
