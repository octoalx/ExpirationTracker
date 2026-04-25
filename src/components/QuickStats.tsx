import { Product } from "@prisma/client";
import { getExpiryStatus } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertTriangle, XCircle } from "lucide-react";

interface QuickStatsProps {
  products?: Product[];
  settings: {
    urgentThreshold: number;
    warningThreshold: number;
  } | null;
}

const QuickStats = ({ products = [], settings }: QuickStatsProps) => {
  const total = products.length;
  const expiringSoon = products.filter(
    (p) =>
      getExpiryStatus(
        new Date(p.expiryDate),
        settings?.urgentThreshold,
        settings?.warningThreshold,
      ) === "urgent" ||
      getExpiryStatus(
        new Date(p.expiryDate),
        settings?.urgentThreshold,
        settings?.warningThreshold,
      ) === "warning",
  ).length;
  const expired = products.filter(
    (p) =>
      getExpiryStatus(
        new Date(p.expiryDate),
        settings?.urgentThreshold,
        settings?.warningThreshold,
      ) === "expired",
  ).length;

  const stats = [
    {
      title: "Всего товаров",
      value: total,
      icon: Package,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/50",
    },
    {
      title: "Скоро истекает",
      value: expiringSoon,
      icon: AlertTriangle,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/50",
    },
    {
      title: "Просрочено",
      value: expired,
      icon: XCircle,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-950/50",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {stats.map((stat) => (
        <Card key={stat.title} size="sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`rounded-md p-1.5 ${stat.bg}`}>
                <stat.icon className={`size-4 ${stat.color}`} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stat.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default QuickStats;
