import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTelegram } from '../scripts/lib/telegram-setup.mjs';

const env = { NEXTAUTH_URL: 'https://example.invalid', TELEGRAM_BOT_TOKEN: 'offline-token',
  TELEGRAM_BOT_USERNAME: 'fixture_bot', TELEGRAM_WEBHOOK_SECRET: 'offline-secret' };
function fixture() {
  const calls = [], messages = [];
  const output = { log: value => messages.push(value), error: value => messages.push(value) };
  const client = {
    async getMe() { calls.push(['getMe']); return { username: 'Fixture_Bot' }; },
    async setMyCommands(commands) { calls.push(['setMyCommands', commands]); },
    async setWebhook(url, options) { calls.push(['setWebhook', url, options]); },
    async getWebhookInfo() { calls.push(['getWebhookInfo']); return { url: 'https://example.invalid/api/telegram/webhook' }; },
  };
  return { calls, messages, client, output, transport(token) { assert.equal(token, env.TELEGRAM_BOT_TOKEN); return client; } };
}

test('preview validates configuration without creating a transport or exposing credentials', async () => {
  const f = fixture();
  assert.equal(await setupTelegram({ env, output: f.output, transport() { assert.fail('Preview created a transport'); } }), 0);
  assert.equal(f.calls.length, 0);
  assert.match(f.messages.join('\n'), /https:\/\/example.invalid\/api\/telegram\/webhook/);
  assert.ok(!f.messages.join('\n').includes(env.TELEGRAM_BOT_TOKEN));
  assert.ok(!f.messages.join('\n').includes(env.TELEGRAM_WEBHOOK_SECRET));
});

test('invalid origins, incomplete credentials and unknown arguments fail before any transport access', async () => {
  for (const config of [
    { ...env, NEXTAUTH_URL: 'not-a-url' }, { ...env, NEXTAUTH_URL: 'http://example.invalid' },
    { ...env, NEXTAUTH_URL: 'https://user:password@example.invalid' },
    { ...env, NEXTAUTH_URL: 'https://example.invalid/path?credential=value' },
    { ...env, NEXTAUTH_URL: 'https://example.invalid/#credential' },
    { ...env, TELEGRAM_BOT_TOKEN: '' }, { ...env, TELEGRAM_WEBHOOK_SECRET: 'spaces are invalid' },
    { ...env, TELEGRAM_BOT_USERNAME: '@fixture_bot' },
  ]) {
    const f = fixture();
    assert.equal(await setupTelegram({ env: config, args: ['--apply'], output: f.output, transport() { assert.fail('Invalid configuration created a transport'); } }), 1);
    assert.ok(!f.messages.join('\n').includes('password'));
  }
  const f = fixture();
  assert.equal(await setupTelegram({ env, args: ['--aplpy'], output: f.output, transport() { assert.fail('Unknown argument created a transport'); } }), 1);
});

test('apply checks bot identity first and preserves pending updates when registering the webhook', async () => {
  const f = fixture();
  assert.equal(await setupTelegram({ env, args: ['--apply'], output: f.output, transport: f.transport }), 0);
  assert.deepEqual(f.calls.map(call => call[0]), ['getMe', 'setMyCommands', 'setWebhook', 'getWebhookInfo']);
  assert.ok(f.calls[1][1].some(command => command.command === 'walk'));
  assert.deepEqual(f.calls[2], ['setWebhook', 'https://example.invalid/api/telegram/webhook', {
    secret_token: env.TELEGRAM_WEBHOOK_SECRET, allowed_updates: ['message', 'callback_query'], max_connections: 2, drop_pending_updates: false,
  }]);
});

test('wrong bot identity stops mutations; API failures and webhook mismatch produce only safe diagnostics', async () => {
  const wrong = fixture(); wrong.client.getMe = async () => ({ username: 'other_bot' });
  assert.equal(await setupTelegram({ env, args: ['--apply'], output: wrong.output, transport: wrong.transport }), 1);
  assert.equal(wrong.calls.length, 0);
  const failed = fixture(); failed.client.setWebhook = async () => { throw new Error(env.TELEGRAM_BOT_TOKEN + env.TELEGRAM_WEBHOOK_SECRET); };
  assert.equal(await setupTelegram({ env, args: ['--apply'], output: failed.output, transport: failed.transport }), 1);
  assert.ok(!failed.messages.join('\n').includes(env.TELEGRAM_BOT_TOKEN));
  assert.ok(!failed.messages.join('\n').includes(env.TELEGRAM_WEBHOOK_SECRET));
  const mismatch = fixture(); mismatch.client.getWebhookInfo = async () => ({ url: 'https://other.invalid/' });
  assert.equal(await setupTelegram({ env, args: ['--apply'], output: mismatch.output, transport: mismatch.transport }), 1);
});
