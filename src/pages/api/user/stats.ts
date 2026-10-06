import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorHandler } from "@/lib/apiErrorHandler";
import { format, startOfDay, subDays } from "date-fns";
import { expiryOverview } from "@/lib/expiry-overview";
import { inventoryScope, inventoryThresholds } from "@/lib/server/inventory";

/** Category mapping based on product name keywords (Russian). */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Цемент": ["цемент"],
  "Песок": ["песок"],
  "Щебень": ["щебень"],
  "Бетон": ["бетон"],
  "Кирпич": ["кирпич"],
  "Блоки": ["блок", "блоки"],
  "Арматура": ["арматура"],
  "Крепеж": ["саморез", "гвоздь", "шуруп", "болт", "гайка", "шайба", "анкер", "дюбель", "крепеж"],
  "Пиломатериалы": ["доска", "брус", "брусок", "вагонка", "фанера", "осб", "osb", "плинтус", "порог", "рейка"],
  "ЛКМ": ["краска", "лак", "грунт", "эмаль", "колер", "шпатлевка", "шпаклевка", "гидроизоляция", "мастика", "герметик", "клей", "пена"],
  "Кровля": ["рубероид", "шифер", "черепица", "профнастил", "сайдинг", "гидро", "паро", "пароизоляция"],
  "Утеплитель": ["утеплитель", "минвата", "пеноплекс", "эковата", "вата", "изол"],
  "Гипсокартон": ["гипсокартон", "гкл", "профиль", "маяк", "серпянка", "подвес"],
  "Металлопрокат": ["уголок", "планка", "кронштейн", "держатель", "соединитель", "заглушка", "проволока", "сетка"],
  "Трубы": ["труба", "фитинг", "колено", "муфта", "заглушка", "кран", "вентиль"],
  "Электрика": ["кабель", "провод", "розетка", "выключатель", "автомат", "светильник", "лампа"],
  "Инструмент": ["инструмент", "дрель", "перфоратор", "шуруповерт", "пила", "нож"],
};

/** Classifies a product into a category by matching keywords in its name. */
function categorizeProduct(name: string): string {
  const lowerName = name.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lowerName.includes(kw))) {
      return category;
    }
  }
  return "Другое";
}

/** GET: comprehensive analytics for the current user's products and notifications. */
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

    // Load user settings for threshold values
    const settings = await inventoryThresholds(prisma, userId);

    const urgentThreshold = settings?.urgentThreshold ?? 3;
    const warningThreshold = settings?.warningThreshold ?? 7;

    // Load all products owned by the user
    const products = await prisma.product.findMany({
      where: (await inventoryScope(prisma, userId)).where,
      orderBy: { createdAt: "desc" },
    });

    // Load email logs for notification metrics
    const emailLogs = await prisma.emailLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();

    // Aggregate counts by product status
    const statusCounts = {
      ACTIVE: 0,
      ARCHIVED: 0,
      DEFECT: 0,
    };

    const overview = expiryOverview(products, now, urgentThreshold, warningThreshold);
    const { expired, urgent, warning, safe, unknown } = overview.counts;
    const productsWithoutQuantity = products.filter(p => p.quantity === null);
    const categoryCounts: Record<string, number> = {};
    let totalQuantity = 0;
    let productsWithQuantity = 0;
    for (const product of products) {
      statusCounts[product.status as keyof typeof statusCounts]++;
      const category = categorizeProduct(product.name);
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      if (product.quantity !== null) {
        totalQuantity += product.quantity;
        productsWithQuantity++;
      }
    }
    const serializeExpiry = (entry: typeof overview.dated[number] | undefined) => entry ? {
      id: entry.product.id, name: entry.product.name, daysLeft: entry.daysLeft,
      expiryDate: entry.product.expiryDate!.toISOString(),
    } : null;

    // Top 5 products by quantity
    const productsWithQty = products.filter(p => p.quantity !== null);
    const topByQuantity = [...productsWithQty]
      .sort((a, b) => (b.quantity || 0) - (a.quantity || 0))
      .slice(0, 5)
      .map(p => ({
        id: p.id,
        name: p.name,
        quantity: p.quantity,
      }));

    // Top 10 categories ranked by total quantity
    const categoryByQuantity: Record<string, number> = {};
    productsWithQty.forEach(p => {
      const cat = categorizeProduct(p.name);
      categoryByQuantity[cat] = (categoryByQuantity[cat] || 0) + (p.quantity || 0);
    });
    const topCategoriesByQuantity = Object.entries(categoryByQuantity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // Products added per day (last 30 days)
    const productsByDay: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const date = format(subDays(now, i), "yyyy-MM-dd");
      productsByDay[date] = 0;
    }
    products.forEach((product) => {
      const date = format(startOfDay(product.createdAt), "yyyy-MM-dd");
      if (productsByDay[date] !== undefined) {
        productsByDay[date]++;
      }
    });
    const productsAddedByDay = Object.entries(productsByDay)
      .map(([date, count]) => ({
        date,
        displayDate: format(new Date(date), "dd.MM"),
        count,
      }))
      .reverse();

    // Email notifications per day (last 14 days)
    const emailByDay: Record<string, number> = {};
    for (let i = 0; i < 14; i++) {
      const date = format(subDays(now, i), "yyyy-MM-dd");
      emailByDay[date] = 0;
    }
    emailLogs.forEach((log) => {
      const date = format(startOfDay(log.sentAt || log.createdAt), "yyyy-MM-dd");
      if (emailByDay[date] !== undefined) {
        emailByDay[date]++;
      }
    });
    const emailByDayArray = Object.entries(emailByDay)
      .map(([date, count]) => ({
        date,
        displayDate: format(new Date(date), "dd.MM"),
        count,
      }))
      .reverse();

    // Most recent email notification
    const lastEmail = emailLogs.length > 0 ? {
      date: emailLogs[0].sentAt?.toISOString() || emailLogs[0].createdAt.toISOString(),
      subject: emailLogs[0].subject,
      status: emailLogs[0].status,
    } : null;

    // Active records within the configured warning window, oldest expiry first
    const problemProductsTable = overview.dated
      .filter(entry => entry.daysLeft <= warningThreshold)
      .map(({ product: p, daysLeft }) => ({
        id: p.id, name: p.name, barcode: p.barcode, quantity: p.quantity,
        expiryDate: p.expiryDate!.toISOString(), daysLeft,
        status: daysLeft < 0 ? "expired" : daysLeft <= urgentThreshold ? "urgent" : "warning",
      }));

    res.status(200).json({
      // KPI totals
      totalProducts: products.length,
      activeProducts: statusCounts.ACTIVE,
      archivedProducts: statusCounts.ARCHIVED,
      defectProducts: statusCounts.DEFECT,
      uniqueCategories: Object.keys(categoryCounts).length,

      // Expiry classification
      expiredCount: expired,
      urgentCount: urgent,
      warningCount: warning,
      safeCount: safe,
      unknownExpiryCount: unknown,
      productsWithoutExpiry: overview.unknown.map(p => ({ id: p.id, name: p.name, barcode: p.barcode })),
      nearestExpiry: serializeExpiry(overview.dated[0]),
      farthestExpiry: serializeExpiry(overview.dated.at(-1)),

      // Quantity statistics
      totalQuantity,
      productsWithQuantity,
      averageQuantity: productsWithQuantity > 0 ? Math.round(totalQuantity / productsWithQuantity) : 0,
      topByQuantity,
      productsWithoutQuantityCount: productsWithoutQuantity.length,
      productsWithoutQuantity: productsWithoutQuantity.slice(0, 10).map(p => ({
        id: p.id,
        name: p.name,
        barcode: p.barcode,
      })),

      // Category breakdown
      categoriesByCount: Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count })),
      topCategoriesByQuantity,

      // Chart datasets
      statusDistribution: {
        expired,
        urgent,
        warning,
        safe,
      },
      statusByType: {
        active: statusCounts.ACTIVE,
        archived: statusCounts.ARCHIVED,
        defect: statusCounts.DEFECT,
      },
      productsAddedByDay,
      emailByDay: emailByDayArray,

      // Notification metrics
      totalEmails: emailLogs.length,
      lastEmail,

      // Attention-needed products
      problemProducts: problemProductsTable,

      // Active thresholds
      urgentThreshold,
      warningThreshold,
    });
  } catch (error) {
    apiErrorHandler(error, res);
  }
}
