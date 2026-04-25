import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorHandler } from "@/lib/apiErrorHandler";
import { differenceInDays, format, startOfDay, subDays } from "date-fns";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const userId = session.user.id;

    // Get user settings
    const settings = await prisma.settings.findUnique({
      where: { userId },
    });

    const urgentThreshold = settings?.urgentThreshold || 3;
    const warningThreshold = settings?.warningThreshold || 7;

    // Get all user products
    const products = await prisma.product.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();

    // Calculate status distribution
    let expired = 0;
    let urgent = 0;
    let warning = 0;
    let safe = 0;

    const urgentProducts: typeof products = [];

    products.forEach((product) => {
      const daysLeft = differenceInDays(product.expiryDate, now);

      if (daysLeft < 0) {
        expired++;
      } else if (daysLeft <= urgentThreshold) {
        urgent++;
        urgentProducts.push(product);
      } else if (daysLeft <= warningThreshold) {
        warning++;
      } else {
        safe++;
      }
    });

    // Get products added by day (last 30 days)
    const thirtyDaysAgo = subDays(now, 30);
    const productsByDay: Record<string, number> = {};

    // Initialize all days with 0
    for (let i = 0; i <= 30; i++) {
      const date = format(subDays(now, i), "yyyy-MM-dd");
      productsByDay[date] = 0;
    }

    // Count products per day
    products.forEach((product) => {
      const date = format(startOfDay(product.createdAt), "yyyy-MM-dd");
      if (productsByDay[date] !== undefined) {
        productsByDay[date]++;
      }
    });

    // Convert to array format for charts
    const productsAddedByDay = Object.entries(productsByDay)
      .map(([date, count]) => ({
        date,
        displayDate: format(new Date(date), "dd.MM"),
        count,
      }))
      .reverse();

    // Get top 5 urgent products (sorted by expiry date)
    const topUrgent = urgentProducts
      .sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime())
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        name: p.name,
        expiryDate: p.expiryDate.toISOString(),
        daysLeft: differenceInDays(p.expiryDate, now),
      }));

    // Category distribution (placeholder - will work when categories are added)
    const categories: Record<string, number> = {};
    // For now, group by status as a fallback
    if (Object.keys(categories).length === 0) {
      categories["В норме"] = safe;
      categories["Внимание"] = warning;
      categories["Срочно"] = urgent;
      categories["Просрочено"] = expired;
    }

    res.status(200).json({
      totalProducts: products.length,
      statusDistribution: {
        expired,
        urgent,
        warning,
        safe,
      },
      productsAddedByDay,
      topUrgent,
      categories: Object.entries(categories).map(([name, count]) => ({
        name,
        count,
      })),
    });
  } catch (error) {
    apiErrorHandler(error, res);
  }
}
