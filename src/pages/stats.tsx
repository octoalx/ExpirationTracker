import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Head from "next/head";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { format, differenceInDays, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Package,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  AlertOctagon,
  TrendingUp,
  Calendar,
  Tag,
} from "lucide-react";

interface StatsData {
  totalProducts: number;
  statusDistribution: {
    expired: number;
    urgent: number;
    warning: number;
    safe: number;
  };
  productsAddedByDay: {
    date: string;
    displayDate: string;
    count: number;
  }[];
  topUrgent: {
    id: string;
    name: string;
    expiryDate: string;
    daysLeft: number;
  }[];
  categories: {
    name: string;
    count: number;
  }[];
}

const COLORS = {
  expired: "#ef4444", // red-500
  urgent: "#f97316", // orange-500
  warning: "#eab308", // yellow-500
  safe: "#10b981", // emerald-500
};

const PIE_COLORS = [COLORS.expired, COLORS.urgent, COLORS.warning, COLORS.safe];

export default function StatsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    if (sessionStatus === "authenticated") {
      fetchStats();
    }
  }, [sessionStatus, router]);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/user/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 size-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-muted-foreground">Загрузка статистики...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Не удалось загрузить статистику</p>
          <Button onClick={fetchStats} variant="outline" className="mt-4">
            Попробовать снова
          </Button>
        </div>
      </div>
    );
  }

  const pieData = [
    { name: "Просрочено", value: stats.statusDistribution.expired, color: COLORS.expired },
    { name: "Срочно", value: stats.statusDistribution.urgent, color: COLORS.urgent },
    { name: "Внимание", value: stats.statusDistribution.warning, color: COLORS.warning },
    { name: "В норме", value: stats.statusDistribution.safe, color: COLORS.safe },
  ].filter((item) => item.value > 0);

  const totalStatusCount =
    stats.statusDistribution.expired +
    stats.statusDistribution.urgent +
    stats.statusDistribution.warning +
    stats.statusDistribution.safe;

  return (
    <>
      <Head>
        <title>Статистика | ExpiTrack</title>
      </Head>

      <div className="mx-auto max-w-7xl p-4">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push("/dashboard")}
            aria-label="Назад"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Статистика</h1>
            <p className="text-sm text-muted-foreground">
              Аналитика ваших товаров
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Всего товаров
                </CardTitle>
                <div className="rounded-md bg-slate-100 p-1.5 dark:bg-slate-800">
                  <Package className="size-3.5 text-slate-600 dark:text-slate-400" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.totalProducts}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  В норме
                </CardTitle>
                <div className="rounded-md bg-emerald-100 p-1.5 dark:bg-emerald-950/50">
                  <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {stats.statusDistribution.safe}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Требуют внимания
                </CardTitle>
                <div className="rounded-md bg-amber-100 p-1.5 dark:bg-amber-950/50">
                  <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {stats.statusDistribution.warning + stats.statusDistribution.urgent}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Просрочено
                </CardTitle>
                <div className="rounded-md bg-red-100 p-1.5 dark:bg-red-950/50">
                  <XCircle className="size-3.5 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {stats.statusDistribution.expired}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          {/* Products by Day Chart */}
          <Card className="col-span-1">
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="size-4 text-emerald-500" />
                <CardTitle className="text-base">Добавление товаров за 30 дней</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.productsAddedByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="displayDate"
                      tick={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                      minTickGap={10}
                    />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      labelFormatter={(label) => `Дата: ${label}`}
                      formatter={(value: number) => [`${value} товаров`, "Добавлено"]}
                    />
                    <Bar
                      dataKey="count"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Status Pie Chart */}
          <Card className="col-span-1">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Tag className="size-4 text-emerald-500" />
                <CardTitle className="text-base">Распределение по статусам</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name}: ${(percent * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number, name: string) => [
                        `${value} (${((value / totalStatusCount) * 100).toFixed(1)}%)`,
                        name,
                      ]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Attention Widget */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-linear-to-r from-red-500 to-orange-500 text-white">
            <div className="flex items-center gap-2">
              <AlertOctagon className="size-5" />
              <CardTitle className="text-base">Требуют внимания — Топ 5 срочных</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {stats.topUrgent.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
                <ShieldCheck className="size-12 text-emerald-500 opacity-60" />
                <p className="text-lg font-medium">Отлично!</p>
                <p className="text-sm">Нет срочных товаров</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {stats.topUrgent.map((product, index) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-sm font-bold text-red-600 dark:bg-red-950/50 dark:text-red-400">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        <Calendar className="mr-1 inline size-3" />
                        {format(parseISO(product.expiryDate), "dd.MM.yyyy")}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                          product.daysLeft < 0
                            ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                            : product.daysLeft === 0
                              ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                              : "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300"
                        }`}
                      >
                        {product.daysLeft < 0
                          ? `Просрочено ${Math.abs(product.daysLeft)} дн.`
                          : product.daysLeft === 0
                            ? "Истекает сегодня"
                            : `Осталось ${product.daysLeft} дн.`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
