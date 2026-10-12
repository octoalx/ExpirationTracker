/** Injectable registration keeps preview and offline verification network-free. */
export async function setupTelegram({ env, args = [], transport, output = console }) {
  let origin;
  try {
    const url = new URL(env.NEXTAUTH_URL);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Invalid origin');
    origin = url.origin;
  } catch {
    output.error('Configure a public HTTPS origin in NEXTAUTH_URL without credentials, paths, queries or fragments.');
    return 1;
  }
  const token = env.TELEGRAM_BOT_TOKEN, secret = env.TELEGRAM_WEBHOOK_SECRET, username = env.TELEGRAM_BOT_USERNAME;
  if (!token || !/^[A-Za-z0-9_-]{1,256}$/.test(secret ?? '') || !/^[A-Za-z0-9_]+$/.test(username ?? '')) {
    output.error('Configure TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME and TELEGRAM_WEBHOOK_SECRET on the server.');
    return 1;
  }
  if (args.some(arg => arg !== '--apply') || args.length > 1) {
    output.error('Usage: node scripts/setup-telegram.mjs [--apply]'); return 1;
  }
  const webhook = new URL('/api/telegram/webhook', origin).toString();
  if (!args.includes('--apply')) {
    output.log(JSON.stringify({ mode: 'preview', username, webhook, updates: ['message', 'callback_query'] }, null, 2));
    output.log('No API calls made. Run with --apply only during an authorized activation.'); return 0;
  }
  try {
    const telegram = transport(token), info = await telegram.getMe();
    if (info.username?.toLowerCase() !== username.toLowerCase()) throw new Error('Bot username mismatch');
    await telegram.setMyCommands([
      { command: 'start', description: 'Начать работу' }, { command: 'help', description: 'Как пользоваться ботом' },
      { command: 'walk', description: 'Начать обход полок' }, { command: 'find', description: 'Найти товар по названию или коду' },
      { command: 'missing', description: 'Не найдены на полке' }, { command: 'unknown', description: 'Уточнить сроки' },
      { command: 'add', description: 'Добавить товар в приложении' }, { command: 'table', description: 'Открыть таблицу' },
      { command: 'settings', description: 'Открыть настройки' },
    ]);
    await telegram.setWebhook(webhook, { secret_token: secret, allowed_updates: ['message', 'callback_query'], max_connections: 2, drop_pending_updates: false });
    if ((await telegram.getWebhookInfo()).url !== webhook) throw new Error('Webhook verification failed');
    output.log('Telegram commands and webhook configured. Link a pilot account in application Settings.'); return 0;
  } catch {
    // Transport exceptions may contain credentials: never expose raw errors.
    output.error('Telegram activation failed. Check bot identity, server configuration and HTTPS reachability.'); return 1;
  }
}
