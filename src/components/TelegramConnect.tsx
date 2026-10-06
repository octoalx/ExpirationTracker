import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export default function TelegramConnect({ onConnected }: { onConnected: () => void }) {
  const [state, setState] = useState<any>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/telegram/link");
      if (!res.ok) throw new Error("Не удалось проверить подключение.");
      setState(await res.json());
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка сети."); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!state?.pending) return;
    const timer = setInterval(() => { void load(); }, 3000);
    return () => clearInterval(timer);
  }, [state?.pending?.expiresAt, load]);
  const act = async (method: string, body?: object) => {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/telegram/link", { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Не удалось подключить Telegram.");
      if (data.url) setUrl(data.url);
      else { setUrl(""); if (method === "POST") onConnected(); }
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка сети."); }
    finally { setBusy(false); }
  };
  return <section className="space-y-3" aria-label="Подключение Telegram">
    {!state ? <p role="status">Проверяем подключение…</p> : <>
      <p>{state.link ? `Подключён: ${state.link.displayName}` : "Telegram пока не подключён."}</p>
      {state.link?.deliveryStatus === "BLOCKED" && <p role="status">Бот заблокирован. Разблокируйте его в Telegram и отправьте /start.</p>}
      {!state.configured && <p className="text-sm text-muted-foreground">Администратор ещё не настроил бота.</p>}
      {state.paused && <p role="status" className="text-sm">Обработка Telegram временно остановлена администратором.</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy || !state.configured} onClick={() => void act("POST")}>
          {state.link ? "Подключить другой аккаунт" : "Подключить Telegram"}
        </Button>
        {(state.link || state.pending) && <Button type="button" variant="outline" disabled={busy} onClick={() => void act("DELETE")}>Отключить / отменить</Button>}
      </div>
      {url && <a className="inline-flex min-h-11 items-center text-blue-700 underline" href={url} target="_blank" rel="noopener noreferrer">Открыть бота в Telegram</a>}
      {state.pending && !state.pending.confirmation && <p role="status" className="text-sm">Нажмите Start у бота, затем вернитесь сюда. Ссылка действует 10 минут.</p>}
      {state.pending?.confirmation && <div className="space-y-2 rounded-lg border p-3">
        <p>Это ваш Telegram-аккаунт: <strong>{state.pending.displayName}</strong>?</p>
        <Button type="button" disabled={busy} onClick={() => void act("POST", { confirmation: state.pending.confirmation })}>Подтвердить аккаунт</Button>
      </div>}
    </>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>;
}
