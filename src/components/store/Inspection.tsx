import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";

const labels = { CHECKED: "Проверен, ещё на полке", MISSING: "Не найден", SOLD: "Полностью продан", REMOVED: "Снят с полки", DEFECT: "Брак" };
export default function Inspection({ data, refresh }: { data: any; refresh: () => void }) {
  const { data: session } = useSession();
  const [mode, setMode] = useState("risk");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<{ product: any; result: string } | null>(null);
  const rows = data.products.filter((p: any) => mode === "missing" ? p.missing : mode === "unknown" ? p.daysLeft === null : p.daysLeft !== null);
  const mutate = async (product: any, result?: string, release = false) => {
    setBusy(product.id); setError("");
    try {
      const res = await fetch(`/api/products/${product.id}/${result ? "actions" : "claim"}`, {
        method: release ? "DELETE" : "POST", headers: { "Content-Type": "application/json" },
        body: release ? undefined : JSON.stringify(result ? { version: product.version, result, key: crypto.randomUUID() } : {}) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message);
      setConfirmation(null); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка сети."); refresh(); }
    finally { setBusy(""); }
  };
  return <section className="space-y-4">
    <div className="work-surface space-y-3 p-4">
      <h2 className="text-lg font-semibold">Обход полок</h2>
      <p>Просрочено: {data.counts.expired} · Срочно: {data.counts.urgent} · Внимание: {data.counts.warning}</p>
      <p className="text-sm text-muted-foreground">Сегодня проверено: {data.counts.checked} · Завершено: {data.counts.resolved}. Проверка наличия сохраняет риск до решения.</p>
      <div className="flex flex-wrap gap-2">{[["risk", "По риску"], ["missing", `Не найдены (${data.counts.missing})`], ["unknown", `Без срока (${data.counts.unknown})`]].map(([key, label]) =>
        <Button key={key} variant={mode === key ? "default" : "outline"} aria-pressed={mode === key} onClick={() => { setMode(key); setConfirmation(null); }}>{label}</Button>)}</div>
    </div>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {!rows.length && <p role="status" className="work-surface p-5">В этой очереди нет записей. Актуальные риски остаются видны в таблице.</p>}
    {rows.map((p: any) => <article key={p.id} className="work-surface space-y-3 p-4 sm:p-5">
      <h3 className="break-words text-lg font-semibold">{p.name}</h3>
      <p className="text-sm">{p.barcode} · Срок: {p.expiryDate?.slice(0, 10) ?? "не указан"} · Количество: {p.quantity ?? "не указано"}</p>
      <p className={p.daysLeft !== null && p.daysLeft < 0 ? "font-medium text-red-700" : "text-sm"}>{p.daysLeft === null ? "Нужно уточнить срок на упаковке" : p.daysLeft < 0 ? `Просрочено на ${-p.daysLeft} дн.` : p.daysLeft === 0 ? "Истекает сегодня" : `До окончания: ${p.daysLeft} дн.`}{p.missing ? " · не найден на полке" : ""}</p>
      {p.checkedAt && <p className="text-sm text-muted-foreground">Проверен: {p.checkedByName} · {new Date(p.checkedAt).toLocaleString("ru-RU", { timeZone: "Europe/Minsk" })}</p>}
      {p.claim && <p role="status" className="text-sm">Проверяет: {p.claim.name}. Закреплено до {new Date(p.claim.expiresAt).toLocaleTimeString("ru-RU", { timeZone: "Europe/Minsk", hour: "2-digit", minute: "2-digit" })}.</p>}
      <div className="flex flex-wrap gap-2">
        {!p.claim && <Button disabled={!!busy} onClick={() => void mutate(p)}>Взять на проверку</Button>}
        {p.claim?.userId === session?.user?.id && <>
          {Object.entries(labels).map(([result, label]) => <Button key={result} variant="outline" disabled={!!busy} onClick={() => {
            if (["SOLD", "REMOVED", "DEFECT"].includes(result)) setConfirmation({ product: p, result }); else void mutate(p, result);
          }}>{label}</Button>)}
          <Button variant="outline" disabled={!!busy} onClick={() => void mutate(p, undefined, true)}>Освободить</Button>
        </>}
        <Link className="inline-flex min-h-11 items-center px-2 text-blue-700 underline" href={`/dashboard?edit=${encodeURIComponent(p.id)}`}>Исправить данные</Link>
      </div>
      {confirmation?.product.id === p.id && <div className="space-y-2 rounded-lg border p-3" role="group" aria-label="Подтверждение результата">
        <p>{labels[confirmation.result]}: {p.name}, срок {p.expiryDate?.slice(0, 10) ?? "не указан"}? Будет обработана вся запись.</p>
        <div className="flex flex-wrap gap-2"><Button disabled={!!busy} onClick={() => void mutate(confirmation.product, confirmation.result)}>Подтвердить</Button><Button variant="outline" onClick={() => setConfirmation(null)}>Отмена</Button></div>
      </div>}
    </article>)}
  </section>;
}
