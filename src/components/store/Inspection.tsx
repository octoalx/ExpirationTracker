import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { expiryBadge } from "@/components/products/ProductTableEnhanced";
import { getExpiryStatus, cn } from "@/lib/utils";
import { expiryDisplay } from "@/lib/expiry-calendar";

const labels = {
  CHECKED: "Проверен, ещё на полке",
  MISSING: "Не найден",
  SOLD: "Полностью продан",
  REMOVED: "Снят с полки",
  DEFECT: "Брак",
};

/** Confirmation is required for results that close the whole record. */
const CLOSING = ["SOLD", "REMOVED", "DEFECT"];
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
  const counts = data.counts;
  const modes = [
    { id: "risk", label: "По риску" },
    { id: "missing", label: `Не найдены (${counts.missing})` },
    { id: "unknown", label: `Без срока (${counts.unknown})` },
  ];
  const badgeFor = (product: any) => product.daysLeft === null ? null
    : expiryBadge(getExpiryStatus(product.expiryDate, data.store?.urgentThreshold, data.store?.warningThreshold), product.daysLeft);
  const confirmed = confirmation?.product;
  return <section className="flex flex-col gap-4 md:gap-5">
    <div className="rounded-xl border border-dash-line bg-dash-panel p-4 md:p-5">
      <h2 className="text-base font-extrabold leading-5 text-dash-ink">Обход полок</h2>
      <div role="group" aria-label="Сводка обхода" className="mt-3 grid grid-cols-3 overflow-hidden rounded-[10px] border border-dash-line">
        {[
          { label: "Просрочено", value: counts.expired, valueClass: "text-dash-expired" },
          { label: "Срочно", value: counts.urgent, valueClass: "text-dash-expired" },
          { label: "Внимание", value: counts.warning, valueClass: "text-dash-amber-ink" },
        ].map((cell, index) => <div
          key={cell.label}
          className={cn("flex flex-col justify-between gap-1 px-3 py-3 md:px-5 md:py-4", index < 2 && "border-r border-dash-line")}
        >
          <span className="text-[12px] font-bold leading-4 text-dash-ink-2 md:text-sm md:leading-5">{cell.label}</span>
          <span className={cn("text-[28px] font-extrabold leading-9 tabular-nums md:text-[40px] md:leading-[48px]", cell.valueClass)}>{cell.value}</span>
        </div>)}
      </div>
      <p className="mt-3 text-[13px] font-semibold leading-5 text-dash-muted">Сегодня проверено: {counts.checked} · Завершено: {counts.resolved}. Проверка наличия сохраняет риск до решения.</p>
      <div role="group" aria-label="Режим обхода" className="mt-3 flex gap-1 rounded-[10px] border border-dash-line bg-dash-surface p-[3px]">
        {modes.map(item => <button
          key={item.id}
          type="button"
          aria-pressed={mode === item.id}
          onClick={() => { setMode(item.id); setConfirmation(null); }}
          className={cn(
            "inline-flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-[7px] px-2 text-[13px] font-semibold transition-colors",
            mode === item.id ? "bg-dash-accent text-white" : "text-dash-ink-2 hover:text-dash-ink",
          )}
        >{item.label}</button>)}
      </div>
    </div>
    {error && <p role="alert" className="rounded-xl border border-dash-expired bg-dash-expired-soft px-4 py-3 text-[13px] font-semibold leading-5 text-dash-expired">{error}</p>}
    {!rows.length && <p role="status" className="rounded-xl border border-dash-line bg-dash-panel px-4 py-5 text-sm leading-5 text-dash-ink-2">В этой очереди нет записей. Актуальные риски остаются видны в таблице.</p>}
    {rows.map((p: any) => {
      const badge = badgeFor(p);
      const overdue = p.daysLeft !== null && p.daysLeft < 0;
      return <article key={p.id} className="rounded-xl border border-dash-line bg-dash-panel p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="order-2 min-w-0 flex-1 md:order-1">
            <h3 className="break-words text-[15px] font-bold leading-5 text-dash-ink md:text-base">{p.name}</h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] font-medium leading-5 tabular-nums text-dash-muted">
              <span className="break-all">{p.barcode}</span>
              <span aria-hidden="true">·</span>
              <span>Количество: {p.quantity ?? "не указано"}</span>
            </p>
          </div>
          <div className="order-1 flex w-full shrink-0 flex-wrap items-center justify-between gap-2 md:order-2 md:w-auto md:flex-col md:items-end md:gap-1">
            <span className="text-[22px] font-extrabold leading-7 tabular-nums text-dash-ink md:text-base md:leading-5">
              {p.expiryDate ? expiryDisplay(p.expiryDate) : "не указан"}
            </span>
            <span className="flex flex-wrap items-center gap-2">
              {badge && <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-bold leading-4", badge.className)}>{badge.label}</span>}
              {p.missing && <span className="inline-flex items-center rounded-full bg-dash-surface px-2.5 py-1 text-[12px] font-bold leading-4 text-dash-ink-2">{labels.MISSING}</span>}
            </span>
          </div>
        </div>
        <div className="mt-2 flex flex-col gap-1">
          <p className={cn("text-[13px] font-semibold leading-5", overdue ? "text-dash-expired" : "text-dash-ink-2")}>
            {p.daysLeft === null ? "Нужно уточнить срок на упаковке" : p.daysLeft < 0 ? `Просрочено на ${-p.daysLeft} дн.` : p.daysLeft === 0 ? "Истекает сегодня" : `До окончания: ${p.daysLeft} дн.`}
          </p>
          {p.checkedAt && <p className="text-[13px] leading-5 text-dash-muted">Проверен: {p.checkedByName} · {new Date(p.checkedAt).toLocaleString("ru-RU", { timeZone: "Europe/Minsk" })}</p>}
          {p.claim && <p role="status" className="text-[13px] leading-5 text-dash-muted">Проверяет: {p.claim.name}. Закреплено до {new Date(p.claim.expiresAt).toLocaleTimeString("ru-RU", { timeZone: "Europe/Minsk", hour: "2-digit", minute: "2-digit" })}.</p>}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 md:flex md:flex-wrap">
          {!p.claim && <Button disabled={!!busy} className="justify-start md:justify-center" onClick={() => void mutate(p)}>Взять на проверку</Button>}
          {p.claim?.userId === session?.user?.id && <>
            {Object.entries(labels).map(([result, label]) => <Button key={result} variant="outline" className="justify-start md:justify-center" disabled={!!busy} onClick={() => {
              if (CLOSING.includes(result)) setConfirmation({ product: p, result }); else void mutate(p, result);
            }}>{label}</Button>)}
            <Button variant="outline" className="justify-start md:justify-center" disabled={!!busy} onClick={() => void mutate(p, undefined, true)}>Освободить</Button>
          </>}
          <Link className="inline-flex min-h-11 items-center px-1 text-sm font-semibold text-dash-accent" href={`/dashboard?edit=${encodeURIComponent(p.id)}`}>Исправить данные</Link>
        </div>
      </article>;
    })}
    <Dialog open={!!confirmation} onOpenChange={open => { if (!open) setConfirmation(null); }}>
      <DialogContent className="work-panel product-dialog product-entry sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{confirmation && confirmed
            ? `${labels[confirmation.result]}: ${confirmed.name}, срок ${confirmed.expiryDate ? expiryDisplay(confirmed.expiryDate) : "не указан"}? Будет обработана вся запись.`
            : "Подтверждение результата"}</DialogTitle>
        </DialogHeader>
        <div className="product-dialog-actions">
          <button type="button" className="dialog-action-secondary" onClick={() => setConfirmation(null)}>Отмена</button>
          <button
            type="button"
            className="primary-action dialog-action-primary"
            disabled={!!busy}
            onClick={() => { if (confirmation) void mutate(confirmation.product, confirmation.result); }}
          >Подтвердить</button>
        </div>
      </DialogContent>
    </Dialog>
  </section>;
}

