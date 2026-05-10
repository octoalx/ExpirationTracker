import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Head from "next/head";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowLeft, Package, AlertTriangle, XCircle, ShieldCheck, AlertOctagon,
  TrendingUp, Calendar, Tag, AlertCircle, Boxes, Hash, Mail, Clock, ChevronRight, Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsData {
  totalProducts: number;
  activeProducts: number;
  archivedProducts: number;
  defectProducts: number;
  uniqueCategories: number;
  expiredCount: number;
  urgentCount: number;
  warningCount: number;
  safeCount: number;
  nearestExpiry: { id: string; name: string; daysLeft: number; expiryDate: string } | null;
  farthestExpiry: { id: string; name: string; daysLeft: number; expiryDate: string } | null;
  totalQuantity: number;
  productsWithQuantity: number;
  averageQuantity: number;
  topByQuantity: { id: string; name: string; quantity: number }[];
  productsWithoutQuantityCount: number;
  productsWithoutQuantity: { id: string; name: string; barcode: string }[];
  categoriesByCount: { name: string; count: number }[];
  topCategoriesByQuantity: { name: string; count: number }[];
  statusDistribution: { expired: number; urgent: number; warning: number; safe: number };
  statusByType: { active: number; archived: number; defect: number };
  productsAddedByDay: { date: string; displayDate: string; count: number }[];
  emailByDay: { date: string; displayDate: string; count: number }[];
  totalEmails: number;
  lastEmail: { date: string; subject: string; status: string } | null;
  problemProducts: { id: string; name: string; barcode: string; quantity: number | null; expiryDate: string; daysLeft: number; status: "expired" | "urgent" }[];
  urgentThreshold: number;
  warningThreshold: number;
}

const COLORS = { expired: "#ef4444", urgent: "#f97316", warning: "#eab308", safe: "#10b981", active: "#3b82f6", archived: "#6b7280", defect: "#8b5cf6" };

/** Placeholder card shown while stats are loading. */
function SkeletonCard() {
  return (
    <Card><CardHeader className="pb-2"><div className="flex items-center justify-between"><div className="h-4 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700" /><div className="h-8 w-8 animate-pulse rounded bg-slate-200 dark:bg-slate-700" /></div></CardHeader><CardContent><div className="h-8 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-700" /></CardContent></Card>
  );
}

/** Placeholder chart shown while stats are loading. */
function SkeletonChart() {
  return <div className="h-64 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />;
}

/** Analytics page with charts, KPI cards, and problem product tables. */
export default function StatsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionStatus === "unauthenticated") { router.push("/auth/signin"); return; }
    if (sessionStatus === "authenticated") { fetchStats(); }
  }, [sessionStatus, router]);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/user/stats");
      if (res.ok) { setStats(await res.json()); }
    } catch (error) { console.error("Failed to fetch stats:", error); }
    finally { setLoading(false); }
  };

  const formatNumber = (num: number) => num.toLocaleString("ru-RU");

  if (sessionStatus === "loading" || loading) {
    return (
      <>
        <Head><title>Статистика | ExpiTrack</title></Head>
        <div className="mx-auto max-w-7xl p-4">
          <div className="mb-6 flex items-center gap-4">
            <div className="h-10 w-10 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div>
              <div className="mb-2 h-8 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-4 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          </div>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <SkeletonChart /><SkeletonChart />
          </div>
        </div>
      </>
    );
  }

  if (!stats) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Не удалось загрузить статистику</p>
          <Button onClick={fetchStats} variant="outline" className="mt-4">Попробовать снова</Button>
        </div>
      </div>
    );
  }

  const expiryPieData = [
    { name: "Просрочено", value: stats.expiredCount, color: COLORS.expired },
    { name: "Срочно", value: stats.urgentCount, color: COLORS.urgent },
    { name: "Внимание", value: stats.warningCount, color: COLORS.warning },
    { name: "В норме", value: stats.safeCount, color: COLORS.safe },
  ].filter(item => item.value > 0);

  const statusPieData = [
    { name: "Активные", value: stats.activeProducts, color: COLORS.active },
    { name: "Архив", value: stats.archivedProducts, color: COLORS.archived },
    { name: "Дефект", value: stats.defectProducts, color: COLORS.defect },
  ].filter(item => item.value > 0);

  const totalExpiryCount = stats.expiredCount + stats.urgentCount + stats.warningCount + stats.safeCount;

  return (
    <>
      <Head><title>Статистика | ExpiTrack</title></Head>
      <div className="mx-auto max-w-7xl p-4">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.push("/dashboard")} aria-label="Назад">
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Статистика</h1>
            <p className="text-sm text-muted-foreground">Аналитика ваших товаров</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Card><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-xs font-medium text-muted-foreground">Всего товаров</CardTitle><div className="rounded-md bg-slate-100 p-1.5 dark:bg-slate-800"><Package className="size-3.5 text-slate-600 dark:text-slate-400" /></div></div></CardHeader><CardContent><p className="text-2xl font-bold">{formatNumber(stats.totalProducts)}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-xs font-medium text-muted-foreground">Активные</CardTitle><div className="rounded-md bg-blue-100 p-1.5 dark:bg-blue-950/50"><ShieldCheck className="size-3.5 text-blue-600 dark:text-blue-400" /></div></div></CardHeader><CardContent><p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatNumber(stats.activeProducts)}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-xs font-medium text-muted-foreground">Просрочено</CardTitle><div className="rounded-md bg-red-100 p-1.5 dark:bg-red-950/50"><XCircle className="size-3.5 text-red-600 dark:text-red-400" /></div></div></CardHeader><CardContent><p className={cn("text-2xl font-bold", stats.expiredCount > 0 ? "text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-400")}>{formatNumber(stats.expiredCount)}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-xs font-medium text-muted-foreground">Истекают</CardTitle><div className="rounded-md bg-amber-100 p-1.5 dark:bg-amber-950/50"><AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400" /></div></div></CardHeader><CardContent><p className={cn("text-2xl font-bold", (stats.urgentCount + stats.warningCount) > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-600 dark:text-slate-400")}>{formatNumber(stats.urgentCount + stats.warningCount)}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-xs font-medium text-muted-foreground">Дефект</CardTitle><div className="rounded-md bg-violet-100 p-1.5 dark:bg-violet-950/50"><AlertCircle className="size-3.5 text-violet-600 dark:text-violet-400" /></div></div></CardHeader><CardContent><p className={cn("text-2xl font-bold", stats.defectProducts > 0 ? "text-violet-600 dark:text-violet-400" : "text-slate-600 dark:text-slate-400")}>{formatNumber(stats.defectProducts)}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-xs font-medium text-muted-foreground">Всего единиц</CardTitle><div className="rounded-md bg-emerald-100 p-1.5 dark:bg-emerald-950/50"><Boxes className="size-3.5 text-emerald-600 dark:text-emerald-400" /></div></div></CardHeader><CardContent><p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatNumber(stats.totalQuantity)}</p></CardContent></Card>
        </div>

        {/* Charts Row 1 - Pie Charts */}
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <Card><CardHeader><div className="flex items-center gap-2"><AlertOctagon className="size-4 text-red-500" /><CardTitle className="text-base">Распределение по срокам годности</CardTitle></div></CardHeader><CardContent><div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={expiryPieData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={80} dataKey="value">{expiryPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}</Pie><Legend /></PieChart></ResponsiveContainer></div></CardContent></Card>
          <Card><CardHeader><div className="flex items-center gap-2"><Layers className="size-4 text-blue-500" /><CardTitle className="text-base">Статусы товаров</CardTitle></div></CardHeader><CardContent><div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusPieData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={80} dataKey="value">{statusPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}</Pie><Legend /></PieChart></ResponsiveContainer></div></CardContent></Card>
        </div>

        {/* Charts Row 2 - Bar Charts */}
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <Card><CardHeader><div className="flex items-center gap-2"><Tag className="size-4 text-emerald-500" /><CardTitle className="text-base">Топ категорий по количеству товаров</CardTitle></div></CardHeader><CardContent><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.categoriesByCount} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} /><XAxis type="number" tick={{ fontSize: 12 }} /><YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} /><Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></CardContent></Card>
          <Card><CardHeader><div className="flex items-center gap-2"><Hash className="size-4 text-blue-500" /><CardTitle className="text-base">Топ-5 товаров по количеству</CardTitle></div></CardHeader><CardContent><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.topByQuantity} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} /><XAxis type="number" tick={{ fontSize: 12 }} /><YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} tickFormatter={(value: string) => value.length > 15 ? value.slice(0, 15) + "..." : value} /><Bar dataKey="quantity" fill="#3b82f6" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></CardContent></Card>
        </div>

        {/* Email Notifications Chart */}
        <Card className="mb-6"><CardHeader><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Mail className="size-4 text-violet-500" /><CardTitle className="text-base">Email-уведомления (последние 14 дней)</CardTitle></div><div className="text-right text-sm text-muted-foreground"><p>Всего: {formatNumber(stats.totalEmails)}</p>{stats.lastEmail && <p className="text-xs">Последнее: {format(parseISO(stats.lastEmail.date), "dd.MM.yyyy HH:mm")}</p>}</div></div></CardHeader><CardContent><div className="h-48"><ResponsiveContainer width="100%" height="100%"><LineChart data={stats.emailByDay}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="displayDate" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 12 }} allowDecimals={false} /><Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: "#8b5cf6", strokeWidth: 2, r: 3 }} /></LineChart></ResponsiveContainer></div></CardContent></Card>

        {/* Products Added Chart */}
        <Card className="mb-6"><CardHeader><div className="flex items-center gap-2"><TrendingUp className="size-4 text-emerald-500" /><CardTitle className="text-base">Добавление товаров за 30 дней</CardTitle></div></CardHeader><CardContent><div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.productsAddedByDay}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="displayDate" tick={{ fontSize: 11 }} interval="preserveStartEnd" /><YAxis tick={{ fontSize: 12 }} allowDecimals={false} /><Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></CardContent></Card>

        {/* Problem Products Table */}
        <Card className="mb-6 overflow-hidden"><CardHeader className="bg-linear-to-r from-red-500 to-orange-500 text-white"><div className="flex items-center gap-2"><AlertOctagon className="size-5" /><CardTitle className="text-base">Требуют внимания</CardTitle></div></CardHeader><CardContent className="p-0">{stats.problemProducts.length === 0 ? (<div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground"><ShieldCheck className="size-12 text-emerald-500 opacity-60" /><p className="text-lg font-medium">Отлично!</p><p className="text-sm">Нет срочных или просроченных товаров</p></div>) : (<Table><TableHeader><TableRow><TableHead>Название</TableHead><TableHead>Штрихкод</TableHead><TableHead className="text-right">Кол-во</TableHead><TableHead>Срок годности</TableHead><TableHead className="text-right">Осталось</TableHead><TableHead>Статус</TableHead></TableRow></TableHeader><TableBody>{stats.problemProducts.map((product) => (<TableRow key={product.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/dashboard?edit=${product.id}`)}><TableCell className="font-medium">{product.name}</TableCell><TableCell className="font-mono text-xs">{product.barcode}</TableCell><TableCell className="text-right">{product.quantity !== null ? formatNumber(product.quantity) : "—"}</TableCell><TableCell><span className="flex items-center gap-1"><Calendar className="size-3" />{format(parseISO(product.expiryDate), "dd.MM.yyyy")}</span></TableCell><TableCell className="text-right"><span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium", product.daysLeft < 0 ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300" : "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300")}><Clock className="size-3" />{product.daysLeft < 0 ? `Просрочено ${Math.abs(product.daysLeft)} дн.` : `Осталось ${product.daysLeft} дн.`}</span></TableCell><TableCell><Badge variant={product.status === "expired" ? "destructive" : "default"} className={cn(product.status === "expired" ? "bg-red-500" : "bg-orange-500")}>{product.status === "expired" ? "Просрочен" : "Срочно"}</Badge></TableCell></TableRow>))}</TableBody></Table>)}</CardContent></Card>

        {/* Products Without Quantity */}
        {stats.productsWithoutQuantityCount > 0 && (
          <Card className="mb-6 overflow-hidden"><CardHeader className="bg-linear-to-r from-amber-500 to-yellow-500 text-white"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><AlertTriangle className="size-5" /><CardTitle className="text-base">Не заполнено количество ({formatNumber(stats.productsWithoutQuantityCount)})</CardTitle></div></div></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Название</TableHead><TableHead>Штрихкод</TableHead><TableHead className="text-right">Действие</TableHead></TableRow></TableHeader><TableBody>{stats.productsWithoutQuantity.map((product) => (<TableRow key={product.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/dashboard?edit=${product.id}`)}><TableCell className="font-medium">{product.name}</TableCell><TableCell className="font-mono text-xs">{product.barcode}</TableCell><TableCell className="text-right"><Button variant="ghost" size="sm">Заполнить<ChevronRight className="ml-1 size-4" /></Button></TableCell></TableRow>))}</TableBody></Table></CardContent></Card>
        )}

        {/* Additional Info Cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Категорий</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{formatNumber(stats.uniqueCategories)}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Среднее кол-во</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{formatNumber(stats.averageQuantity)} шт.</p></CardContent></Card>
          {stats.nearestExpiry && (<Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Ближайший срок</CardTitle></CardHeader><CardContent><p className="text-sm font-medium truncate" title={stats.nearestExpiry.name}>{stats.nearestExpiry.name}</p><p className={cn("text-sm", stats.nearestExpiry.daysLeft < 0 ? "text-red-500" : "text-orange-500")}>{stats.nearestExpiry.daysLeft < 0 ? `Просрочен ${Math.abs(stats.nearestExpiry.daysLeft)} дн.` : `Осталось ${stats.nearestExpiry.daysLeft} дн.`}</p></CardContent></Card>)}
          <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">С уведомлениями</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{formatNumber(stats.totalEmails)}</p></CardContent></Card>
        </div>
      </div>
    </>
  );
}
