import React from "react";
import { Package, AlertOctagon, Clock, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ProductStatsProps {
  total?: number;
  expired?: number;
  expiring7?: number;
  expiring30?: number;
}

export function ProductStats({
  total = 0,
  expired = 0,
  expiring7 = 0,
  expiring30 = 0,
}: ProductStatsProps) {
  const stats = [
    {
      title: "Всего товаров",
      value: total,
      icon: Package,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/50",
    },
    {
      title: "Просрочено",
      value: expired,
      icon: AlertOctagon,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-950/50",
    },
    {
      title: "Истекает за 7 дней",
      value: expiring7,
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/50",
    },
    {
      title: "Истекает за 30 дней",
      value: expiring30,
      icon: CalendarClock,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/50",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`rounded-md p-1.5 ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
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
}
