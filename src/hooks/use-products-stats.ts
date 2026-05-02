import { useQuery } from "@tanstack/react-query";

export interface ProductStatsData {
  totalProducts: number;
  statusDistribution: {
    expired: number;
    urgent: number;
    warning: number;
    safe: number;
  };
  productsAddedByDay: Array<{
    date: string;
    displayDate: string;
    count: number;
  }>;
  topUrgent: Array<{
    id: string;
    name: string;
    expiryDate: string;
    daysLeft: number;
  }>;
  categories: Array<{
    name: string;
    count: number;
  }>;
}

async function fetchProductsStats(): Promise<ProductStatsData> {
  const res = await fetch("/api/user/stats");
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

export function useProductsStats() {
  return useQuery<ProductStatsData>({
    queryKey: ["products", "stats"],
    queryFn: fetchProductsStats,
    staleTime: 60_000,
  });
}
