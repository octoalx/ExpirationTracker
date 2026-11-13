import { useCallback, useEffect, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import ConfirmAction from "@/components/admin/ConfirmAction";

const labels = { QUEUED: "В очереди", PROCESSING: "Отправляется", SENT: "Отправлено", FAILED: "Ошибка", CANCELLED: "Отменено", EMPTY: "Нет товаров" };

export default function TelegramStatus() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  /** The state change is confirmed in the app dialog, not in a browser window. */
  const [confirmToggle, setConfirmToggle] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/telegram"); const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      setData(result); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка сети."); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const toggle = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/telegram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paused: !data.paused }) });
      if (!res.ok) throw new Error("Не удалось изменить состояние.");
      setConfirmToggle(false);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка сети."); }
    finally { setBusy(false); }
  };

  return <section className="space-y-4 rounded-xl border border-dash-line bg-dash-panel p-4 md:p-5">
    <div className="flex items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-dash-soft text-dash-accent" aria-hidden="true">
        <Send className="size-5" />
      </span>
      <h2 className="text-[15px] font-extrabold leading-5 text-dash-ink">Работа Telegram</h2>
    </div>

    {data ? <>
      <p className="text-[15px] font-semibold leading-5 text-dash-ink">
        {!data.configured ? "Бот ещё не настроен на сервере." : data.paused ? "Обработка остановлена." : "Обработка включена."}
      </p>
      <p className="text-[13px] leading-5 text-dash-muted">После восстановления копии сначала проверьте команду и товары. Уже отправляемое сообщение может завершиться после остановки.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => setConfirmToggle(true)} className={data.paused ? "primary-action gap-2 text-[15px]" : "dialog-action-danger gap-2"}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {data.paused ? "Возобновить" : "Остановить обработку"}
        </button>
        <button type="button" className="dialog-action-secondary" onClick={() => void load()}>Обновить</button>
      </div>
      <p className="text-[13px] leading-5 text-dash-ink-2">Необработанных ошибок входящих сообщений: <span className="tabular-nums font-semibold text-dash-ink">{data.failedUpdates}</span></p>

      <h3 className="border-t border-dash-line pt-4 text-[15px] font-extrabold leading-5 text-dash-ink">Последние сводки</h3>
      {!data.deliveries.length
        ? <p role="status" className="text-[13px] leading-5 text-dash-muted">Сводок пока нет.</p>
        : <ul className="divide-y divide-dash-line rounded-[10px] border border-dash-line">
          {data.deliveries.map((item: any) => <li key={item.id} className="px-3 py-2.5 text-[13px] leading-5">
            <p className="tabular-nums text-dash-ink">{item.scheduleDate} · {item.kind === "BOTH" ? "Общая сводка" : item.kind === "URGENT" ? "Срочно" : "Внимание"} · {labels[item.state] ?? item.state}</p>
            <p className="text-dash-muted">Попыток: <span className="tabular-nums">{item.attempts}</span>{item.error ? ` · ${item.error}` : ""}</p>
          </li>)}
        </ul>}
    </> : <p role="status" className="text-[13px] leading-5 text-dash-muted">Загружаем состояние…</p>}

    {error && <p role="alert" className="rounded-[10px] border border-dash-expired bg-dash-expired-soft px-3 py-2 text-[13px] font-semibold leading-5 text-dash-expired">{error}</p>}

    <ConfirmAction
      open={confirmToggle}
      title={data?.paused ? "Возобновить Telegram?" : "Остановить обработку Telegram?"}
      description={data?.paused
        ? "Данные и привязки проверены после восстановления? Очередь начнёт обрабатываться снова."
        : "Новые входящие сообщения перестанут обрабатываться до возобновления. Уже отправляемое сообщение может завершиться."}
      confirmLabel={data?.paused ? "Возобновить" : "Остановить обработку"}
      busy={busy}
      danger={!data?.paused}
      onCancel={() => setConfirmToggle(false)}
      onConfirm={() => void toggle()}
    />
  </section>;
}
