import React from "react";
import { Package, AlertOctagon, Clock, CalendarClock } from "lucide-react";
import {
  Stat,
  StatLabel,
  StatValue,
  StatTrend,
  StatIndicator,
} from "@/components/ui/stat";

export interface ProductStatsProps {
  total?: number;
  expired?: number;
  expiring7?: number;
  expiring30?: number;
  totalTrend?: string;
  expiredTrend?: string;
  expiring7Trend?: string;
  expiring30Trend?: string;
}

export function ProductStats({
  total = 42,
  expired = 3,
  expiring7 = 5,
  expiring30 = 12,
  totalTrend = "+2%",
  expiredTrend = "+1",
  expiring7Trend = "-1",
  expiring30Trend = "+3",
}: ProductStatsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Stat>
        <StatIndicator color="default">
          <Package className="h-5 w-5" />
        </StatIndicator>
        <StatLabel>Всего товаров</StatLabel>
        <StatValue>{total}</StatValue>
        <StatTrend trend="neutral">{totalTrend} с прошлой недели</StatTrend>
      </Stat>

      <Stat>
        <StatIndicator color="error">
          <AlertOctagon className="h-5 w-5" />
        </StatIndicator>
        <StatLabel>Просрочено</StatLabel>
        <StatValue>{expired}</StatValue>
        <StatTrend trend="down">{expiredTrend} с прошлой недели</StatTrend>
      </Stat>

      <Stat>
        <StatIndicator color="warning">
          <Clock className="h-5 w-5" />
        </StatIndicator>
        <StatLabel>Истекает за 7 дней</StatLabel>
        <StatValue>{expiring7}</StatValue>
        <StatTrend trend="up">{expiring7Trend} с прошлой недели</StatTrend>
      </Stat>

      <Stat>
        <StatIndicator color="info">
          <CalendarClock className="h-5 w-5" />
        </StatIndicator>
        <StatLabel>Истекает за 30 дней</StatLabel>
        <StatValue>{expiring30}</StatValue>
        <StatTrend trend="neutral">{expiring30Trend} с прошлой недели</StatTrend>
      </Stat>
    </div>
  );
}
