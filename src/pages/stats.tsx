import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Head from "next/head";
import { useRouter } from "next/router";
import { format, parseISO } from "date-fns";
import { ArrowUpRight, RefreshCw, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

function RecordLink({ product, children }: { product: InventoryRecord; children?: React.ReactNode }) {
  return <Link href={{ pathname: "/dashboard", query: { edit: product.id } }} className="flex min-h-20 items-center gap-3 border-t border-slate-200 px-4 py-4 hover:bg-slate-50">
    <span className="min-w-0 flex-1"><span className="block font-bold leading-snug text-slate-950 break-words">{product.name}</span><span className="mt-1 block break-all text-sm tabular-nums text-slate-600">{product.barcode}</span>{children}</span>
    <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-slate-500" />
  </Link>;
}

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
  return <>
    <Head><title>Статистика | ExpiTrack</title></Head>
    <div className="mx-auto max-w-5xl space-y-4 md:space-y-6">
      <header><h1>Статистика</h1><p className="mt-1 text-sm leading-relaxed text-slate-600">Сроки активных товаров и задачи на сегодня</p></header>
      {error ? <div role="alert" className="work-surface p-5"><h2>Не удалось загрузить данные</h2><p className="mt-2 text-sm text-slate-600">Попробуйте обновить статистику ещё раз.</p><Button className="mt-4" onClick={() => void fetchStats()}>Повторить</Button></div> : !stats ? <div role="status" aria-label="Загрузка статистики" className="space-y-4"><div className="h-36 animate-pulse rounded-xl bg-slate-100" /><div className="h-64 animate-pulse rounded-xl bg-slate-100" /></div> : <>
        {stats.totalProducts === 0 && <div className="work-surface p-5"><h2>Начните с первого товара</h2><p className="mt-2 text-sm text-slate-600">Добавьте товар и его срок — здесь появятся задачи для проверки.</p><Link href="/dashboard" className="primary-action mt-4">Добавить товар</Link></div>}
        <section aria-label="Состояние активных товаров" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[{ label: "Просрочено", count: stats.expiredCount, color: "text-red-800", surface: "bg-red-50", filter: "expired" as const }, { label: "Скоро истекает", count: stats.urgentCount + stats.warningCount, color: "text-expiry-ink", surface: "bg-expiry-soft", filter: "soon" as const }].map(item => <button key={item.label} type="button" onClick={() => setRiskFilter(item.filter)} aria-pressed={riskFilter === item.filter} className={cn("rounded-xl px-4 py-3 text-left ring-1 ring-inset ring-slate-200", item.surface, riskFilter === item.filter && "ring-2 ring-blue-700")}><span className={cn("block text-3xl font-extrabold tabular-nums", item.color)}>{item.count}</span><span className="mt-1 flex items-center justify-between gap-2 text-sm font-semibold text-slate-800">{item.label}<ArrowUpRight aria-hidden="true" className="size-4 shrink-0" /></span></button>)}
          <div className="work-surface px-4 py-3"><strong className="block text-3xl font-extrabold tabular-nums">{stats.safeCount}</strong><span className="mt-1 block text-sm text-slate-600">В норме</span></div>
          <a href="#missing-expiry" className="work-surface px-4 py-3"><strong className="block text-3xl font-extrabold tabular-nums">{stats.unknownExpiryCount}</strong><span className="mt-1 flex items-center justify-between gap-2 text-sm text-slate-600">Без срока<ArrowUpRight aria-hidden="true" className="size-4 shrink-0" /></span></a>
        </section>
        <section className="work-surface overflow-hidden"><div className="p-4"><h2 className="text-xl">Требуют внимания <span className="text-slate-500">{stats.problemProducts.length}</span></h2><div className="entry-segment mt-3" role="group" aria-label="Фильтр рисков">{[{ id: "all", label: "Все" }, { id: "expired", label: "Просрочено" }, { id: "soon", label: "Близкий срок" }].map(item => <button key={item.id} type="button" aria-pressed={riskFilter === item.id} onClick={() => setRiskFilter(item.id as typeof riskFilter)} >{item.label}</button>)}</div></div>
          {risks.length ? risks.map(product => <RecordLink key={product.id} product={product}><span className={cn("mt-2 inline-flex flex-wrap items-center gap-2 rounded-md px-2 py-1 text-sm", product.daysLeft < 0 ? "bg-red-50 text-red-800" : "bg-expiry-soft text-expiry-ink")}><span aria-hidden="true" className={cn("size-2.5 rounded-full", product.daysLeft < 0 ? "bg-red-600" : "bg-expiry-marker")} />{format(parseISO(product.expiryDate), "dd.MM.yyyy")} · {product.daysLeft < 0 ? `Просрочено: ${Math.abs(product.daysLeft)} дн.` : product.daysLeft === 0 ? "Истекает сегодня" : `Осталось: ${product.daysLeft} дн.`}</span></RecordLink>) : <p className="border-t border-slate-200 p-5 text-sm text-slate-600">{stats.activeProducts === 0 ? "Нет активных товаров для проверки." : "В этой группе нет товаров, требующих внимания."}</p>}
          <p className="border-t border-slate-200 px-4 py-3 text-xs leading-relaxed text-slate-500">Оценка по {stats.activeProducts} активным записям. Близкий срок — до {stats.warningThreshold} дней включительно; срочный — до {stats.urgentThreshold}. Архив и брак исключены из проверки сроков.</p>
        </section>
        <section id="missing-expiry" className="work-surface scroll-mt-6 overflow-hidden"><div className="p-4"><h2 className="text-xl">Срок не указан <span className="text-slate-500">{stats.unknownExpiryCount}</span></h2><p className="mt-2 text-sm leading-relaxed text-slate-600">У этих активных товаров нельзя оценить остаток срока. Откройте запись, если дата уже известна.</p></div>{stats.productsWithoutExpiry.length ? stats.productsWithoutExpiry.map(product => <RecordLink key={product.id} product={product}><span className="mt-2 block text-sm font-semibold text-blue-700">Указать срок</span></RecordLink>) : <p className="border-t border-slate-200 p-4 text-sm text-slate-600">Нет активных товаров без указанного срока.</p>}</section>
        <section className="work-surface p-4"><h2 className="text-xl">Состав базы</h2><dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">{[{ label: "Всего записей", count: stats.totalProducts }, { label: "Активные", count: stats.activeProducts }, { label: "Архив", count: stats.archivedProducts }, { label: "Брак", count: stats.defectProducts }].map(item => <div key={item.label}><dt className="text-sm text-slate-600">{item.label}</dt><dd className="mt-1 text-xl font-bold tabular-nums">{item.count}</dd></div>)}</dl></section>
        <details className="work-surface"><summary className="flex min-h-14 cursor-pointer items-center px-4 text-base font-bold">Активность и уведомления</summary><div className="px-4 pb-4"><p className="text-sm text-slate-600">Добавлено за 30 дней: <strong>{stats.productsAddedByDay.reduce((sum, day) => sum + day.count, 0)}</strong></p><p className="mt-2 text-sm text-slate-600">Записей в журнале email: <strong>{stats.totalEmails}</strong>. Это количество попыток, а не подтверждение доставки.</p>{stats.lastEmail && <p className="mt-2 break-words text-sm text-slate-600">Последняя запись: {format(parseISO(stats.lastEmail.date), "dd.MM.yyyy HH:mm")} · {stats.lastEmail.status}</p>}<Link href="/settings" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-700">Настроить уведомления<ChevronRight className="size-4" /></Link></div></details>
      </>}
      {stats && !error && <Button variant="ghost" disabled={loading} onClick={() => void fetchStats()} className="min-h-11 gap-2 text-slate-600"><RefreshCw aria-hidden="true" className={cn("size-4", loading && "animate-spin")} />{loading ? "Обновление…" : "Обновить данные"}</Button>}
    </div>
  </>;
}
