import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const labels = { QUEUED: "В очереди", PROCESSING: "Отправляется", SENT: "Отправлено", FAILED: "Ошибка", CANCELLED: "Отменено", EMPTY: "Нет товаров" };
export default function TelegramStatus() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/telegram"); const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      setData(result); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка сети."); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const toggle = async () => {
    if (data.paused && !window.confirm("Данные и привязки проверены после восстановления? Возобновить Telegram?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/telegram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paused: !data.paused }) });
      if (!res.ok) throw new Error("Не удалось изменить состояние."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка сети."); }
    finally { setBusy(false); }
  };
  return <section className="work-surface space-y-4 p-4 sm:p-6">
    <h2 className="text-lg font-semibold">Работа Telegram</h2>
    {data ? <>
      <p>{!data.configured ? "Бот ещё не настроен на сервере." : data.paused ? "Обработка остановлена." : "Обработка включена."}</p>
      <p className="text-sm text-muted-foreground">После восстановления копии сначала проверьте команду и товары. Уже отправляемое сообщение может завершиться после остановки.</p>
      <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void toggle()}>{data.paused ? "Возобновить" : "Остановить обработку"}</Button><Button variant="outline" onClick={() => void load()}>Обновить</Button></div>
      <p>Необработанных ошибок входящих сообщений: {data.failedUpdates}</p>
      <h3 className="font-semibold">Последние сводки</h3>
      {!data.deliveries.length && <p role="status">Сводок пока нет.</p>}
      <ul className="divide-y">{data.deliveries.map((item: any) => <li key={item.id} className="py-2 text-sm">
        <p>{item.scheduleDate} · {item.kind === "BOTH" ? "Общая сводка" : item.kind === "URGENT" ? "Срочно" : "Внимание"} · {labels[item.state] ?? item.state}</p>
        <p className="text-muted-foreground">Попыток: {item.attempts}{item.error ? ` · ${item.error}` : ""}</p>
      </li>)}</ul>
    </> : <p role="status">Загружаем состояние…</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </section>;
}
