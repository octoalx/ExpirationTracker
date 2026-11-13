import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Head from "next/head";
import { useRouter } from "next/router";
import { format, parseISO } from "date-fns";
import { ArrowUpRight, RefreshCw, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, getExpiryStatus } from "@/lib/utils";
import { expiryBadge } from "@/components/products/ProductTableEnhanced";

interface InventoryRecord { id: string; name: string; barcode: string }
interface RiskRecord extends InventoryRecord { expiryDate: string; daysLeft: number; quantity: number | null }
interface StatsData {
  totalProducts: number; activeProducts: number; archivedProducts: number; defectProducts: number;
  expiredCount: number; urgentCount: number; warningCount: number; safeCount: number;
  unknownExpiryCount: number; productsWithoutExpiry: InventoryRecord[]; problemProducts: RiskRecord[];
  urgentThreshold: number; warningThreshold: number;
  productsAddedByDay: { date: string; displayDate: string; count: number }[];
  totalEmails: number; lastEmail: { date: string; status: string; subject: string } | null;
}

/** One record row; the whole row is the target, so it stays above 44 px on a phone. */
function RecordLink({ product, children }: { product: InventoryRecord; children?: React.ReactNode }) {
  return <Link
    href={{ pathname: "/dashboard", query: { edit: product.id } }}
    className="flex min-h-16 items-center gap-3 border-t border-dash-line px-4 py-3 hover:bg-dash-surface md:min-h-12"
  >
    <span className="min-w-0 flex-1">
      <span className="block text-[15px] font-bold leading-5 break-words text-dash-ink">{product.name}</span>
      <span className="mt-0.5 block text-[13px] font-medium leading-5 break-all tabular-nums text-dash-muted">{product.barcode}</span>
      {children}
    </span>
    <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-dash-muted" />
  </Link>;
}

/** A dashboard-style summary cell: one number, one label, an optional note. */
function CellBody({ label, value, hint, valueClass, icon }: { label: string; value: number; hint?: string; valueClass: string; icon?: React.ReactNode }) {
  return <>
    <span className="flex items-center gap-1.5 text-[12px] font-bold leading-4 text-dash-ink-2 md:text-sm md:leading-5">{label}{icon}</span>
    <span className={cn("text-[28px] font-extrabold leading-9 tabular-nums md:text-[40px] md:leading-[48px]", valueClass)}>{value}</span>
    {/* The note line is kept on a desktop even when empty, so all four numbers share a baseline. */}
    <span className="hidden text-[13px] font-semibold leading-5 text-dash-muted md:block">{hint ?? "\u00A0"}</span>
  </>;
}

const CELL = "flex min-h-[76px] flex-col justify-between gap-1 border-dash-line bg-dash-panel px-4 py-3 text-left transition-colors md:min-h-[126px] md:px-6 md:py-4";

/** Daily operational overview: risks first, records next, context last. */
export default function StatsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [riskFilter, setRiskFilter] = useState<"all" | "expired" | "soon">("all");
  const fetchStats = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(false);
    try {
      const response = await fetch("/api/user/stats", { signal });
      if (!response.ok) throw new Error("Statistics request failed");
      const data = await response.json();
      if (!signal?.aborted) setStats(data);
    } catch {
      if (!signal?.aborted) setError(true);
    } finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    if (status === "unauthenticated") { void router.replace("/auth/signin"); return; }
    if (status !== "authenticated") return;
    const controller = new AbortController();
    void fetchStats(controller.signal);
    return () => controller.abort();
  }, [status, router, fetchStats]);
  const risks = stats?.problemProducts.filter(p => riskFilter === "all" || (riskFilter === "expired" ? p.daysLeft < 0 : p.daysLeft >= 0)) ?? [];
  const maxOverdue = stats?.problemProducts.reduce((max, product) => product.daysLeft < 0 ? Math.max(max, -product.daysLeft) : max, 0) ?? 0;
  const riskFilters: ReadonlyArray<{ id: "all" | "expired" | "soon"; label: string }> = [
    { id: "all", label: "Все" },
    { id: "expired", label: "Просрочено" },
    { id: "soon", label: "Близкий срок" },
  ];
  return <>
    <Head><title>Статистика | ExpiTrack</title></Head>
    <div className="inventory-page mx-auto flex w-full max-w-7xl flex-col gap-4 md:gap-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="work-page-title">Статистика</h1>
          <p className="mt-1 text-[13px] font-medium leading-5 text-dash-muted">Сроки активных товаров и задачи на сегодня</p>
        </div>
      </header>
      {error ? <div role="alert" className="space-y-2 rounded-xl border border-dash-expired bg-dash-panel p-5">
        <h2 className="text-base font-extrabold leading-5 text-dash-ink">Не удалось загрузить данные</h2>
        <p className="text-sm leading-5 text-dash-ink-2">Попробуйте обновить статистику ещё раз.</p>
        <Button className="min-h-11" onClick={() => void fetchStats()}>Повторить</Button>
      </div> : !stats ? <div role="status" aria-label="Загрузка статистики" className="space-y-4">
        <div className="h-32 animate-pulse rounded-xl bg-dash-surface" />
        <div className="h-64 animate-pulse rounded-xl bg-dash-surface" />
      </div> : <>
        {stats.totalProducts === 0 && <div className="space-y-2 rounded-xl border border-dash-line bg-dash-panel p-5">
          <h2 className="text-base font-extrabold leading-5 text-dash-ink">Начните с первого товара</h2>
          <p className="text-sm leading-5 text-dash-ink-2">Добавьте товар и его срок — здесь появятся задачи для проверки.</p>
          <Link href="/dashboard" className="primary-action mt-2">Добавить товар</Link>
        </div>}
        <section aria-label="Состояние активных товаров" className="grid grid-cols-2 overflow-hidden rounded-xl border border-dash-line bg-dash-panel md:grid-cols-4">
          <button
            type="button"
            aria-pressed={riskFilter === "expired"}
            onClick={() => setRiskFilter("expired")}
            className={cn(CELL, "border-b border-r md:border-b-0", riskFilter === "expired" ? "bg-dash-soft" : "hover:bg-dash-surface")}
          >
            <CellBody
              label="Просрочено"
              value={stats.expiredCount}
              hint={stats.expiredCount > 0 ? `Просрочено на ${maxOverdue} дн.` : "Нет просроченных записей"}
              valueClass="text-dash-expired"
            />
          </button>
          <button
            type="button"
            aria-pressed={riskFilter === "soon"}
            onClick={() => setRiskFilter("soon")}
            className={cn(CELL, "border-b md:border-b-0 md:border-r", riskFilter === "soon" ? "bg-dash-soft" : "hover:bg-dash-surface")}
          >
            <CellBody
              label="Скоро истекает"
              value={stats.urgentCount + stats.warningCount}
              hint={`Срочно: ${stats.urgentCount} · Внимание: ${stats.warningCount}`}
              valueClass="text-dash-amber-ink"
            />
          </button>
          <div className={cn(CELL, "border-r")}>
            <CellBody label="В норме" value={stats.safeCount} valueClass="text-dash-ink" />
          </div>
          <a href="#missing-expiry" className={cn(CELL, "hover:bg-dash-surface")}>
            <CellBody
              label="Без срока"
              value={stats.unknownExpiryCount}
              valueClass="text-dash-ink"
              icon={<ArrowUpRight aria-hidden="true" className="size-3.5 text-dash-muted" />}
            />
          </a>
        </section>
        <section className="overflow-hidden rounded-xl border border-dash-line bg-dash-panel">
          <div className="p-4 md:p-5">
            <h2 className="text-base font-extrabold leading-5 text-dash-ink">Требуют внимания <span className="text-dash-muted">{stats.problemProducts.length}</span></h2>
            <div role="group" aria-label="Фильтр рисков" className="mt-3 flex gap-1 rounded-[10px] border border-dash-line bg-dash-surface p-[3px] md:w-fit">
              {riskFilters.map(item => <button
                key={item.id}
                type="button"
                aria-pressed={riskFilter === item.id}
                onClick={() => setRiskFilter(item.id)}
                className={cn(
                  "inline-flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-[7px] px-3 text-[13px] font-semibold transition-colors md:flex-none",
                  riskFilter === item.id ? "bg-dash-accent text-white" : "text-dash-ink-2 hover:text-dash-ink",
                )}
              >{item.label}</button>)}
            </div>
          </div>
          {risks.length ? risks.map(product => {
            const badge = expiryBadge(getExpiryStatus(product.expiryDate, stats.urgentThreshold, stats.warningThreshold), product.daysLeft);
            return <RecordLink key={product.id} product={product}>
              <span className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-semibold leading-5 tabular-nums text-dash-ink-2">{format(parseISO(product.expiryDate), "dd.MM.yyyy")}</span>
                <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-bold leading-4", badge.className)}>{badge.label}</span>
              </span>
            </RecordLink>;
          }) : <p className="border-t border-dash-line p-5 text-sm leading-5 text-dash-ink-2">{stats.activeProducts === 0 ? "Нет активных товаров для проверки." : "В этой группе нет товаров, требующих внимания."}</p>}
          <p className="border-t border-dash-line px-4 py-3 text-[13px] leading-5 text-dash-muted">Оценка по {stats.activeProducts} активным записям. Близкий срок — до {stats.warningThreshold} дней включительно; срочный — до {stats.urgentThreshold}. Архив и брак исключены из проверки сроков.</p>
        </section>
        <section id="missing-expiry" className="scroll-mt-6 overflow-hidden rounded-xl border border-dash-line bg-dash-panel">
          <div className="p-4 md:p-5">
            <h2 className="text-base font-extrabold leading-5 text-dash-ink">Срок не указан <span className="text-dash-muted">{stats.unknownExpiryCount}</span></h2>
            <p className="mt-1 text-sm leading-5 text-dash-ink-2">У этих активных товаров нельзя оценить остаток срока. Откройте запись, если дата уже известна.</p>
          </div>
          {stats.productsWithoutExpiry.length ? stats.productsWithoutExpiry.map(product => <RecordLink key={product.id} product={product}>
            <span className="mt-1.5 block text-[13px] font-semibold leading-5 text-dash-accent">Указать срок</span>
          </RecordLink>) : <p className="border-t border-dash-line p-4 text-sm leading-5 text-dash-ink-2">Нет активных товаров без указанного срока.</p>}
        </section>
        <section className="rounded-xl border border-dash-line bg-dash-panel p-4 md:p-5">
          <h2 className="text-base font-extrabold leading-5 text-dash-ink">Состав базы</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            {[{ label: "Всего записей", count: stats.totalProducts }, { label: "Активные", count: stats.activeProducts }, { label: "Архив", count: stats.archivedProducts }, { label: "Брак", count: stats.defectProducts }].map(item => <div key={item.label}>
              <dt className="text-[13px] leading-5 text-dash-muted">{item.label}</dt>
              <dd className="mt-0.5 text-[22px] font-extrabold leading-7 tabular-nums text-dash-ink">{item.count}</dd>
            </div>)}
          </dl>
        </section>
        <details className="overflow-hidden rounded-xl border border-dash-line bg-dash-panel">
          <summary className="flex min-h-14 cursor-pointer items-center px-4 text-base font-extrabold text-dash-ink">Активность и уведомления</summary>
          <div className="px-4 pb-4">
            <p className="text-sm leading-5 text-dash-ink-2">Добавлено за 30 дней: <strong className="tabular-nums text-dash-ink">{stats.productsAddedByDay.reduce((sum, day) => sum + day.count, 0)}</strong></p>
            <p className="mt-2 text-sm leading-5 text-dash-ink-2">Записей в журнале email: <strong className="tabular-nums text-dash-ink">{stats.totalEmails}</strong>. Это количество попыток, а не подтверждение доставки.</p>
            {stats.lastEmail && <p className="mt-2 text-sm leading-5 break-words text-dash-ink-2">Последняя запись: {format(parseISO(stats.lastEmail.date), "dd.MM.yyyy HH:mm")} · {stats.lastEmail.status}</p>}
            <Link href="/settings" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-dash-accent">Настроить уведомления<ChevronRight className="size-4" /></Link>
          </div>
        </details>
      </>}
      {stats && !error && <Button variant="ghost" disabled={loading} onClick={() => void fetchStats()} className="min-h-11 gap-2 self-start text-dash-ink-2"><RefreshCw aria-hidden="true" className={cn("size-4", loading && "animate-spin")} />{loading ? "Обновление…" : "Обновить данные"}</Button>}
    </div>
  </>;
}
