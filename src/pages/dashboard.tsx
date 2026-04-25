import { useState, useEffect, useMemo } from "react";
import { Product } from "@prisma/client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { getExpiryStatus, cn } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import AddProductForm from "../components/AddProductForm";
import ProductCard from "@/components/ProductCard";
import ViewToggle from "@/components/ViewToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Package,
  AlertTriangle,
  XCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  PackageOpen,
} from "lucide-react";

/* ── Typing animation hook ───────────────────────────────────────────── */
function useTypingText(text: string, speed = 60) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return displayed;
}

/* ── Chip filter component ───────────────────────────────────────────── */
interface ChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function Chip({ label, active, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200",
        active
          ? "text-white"
          : "text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700",
      )}
    >
      {active && (
        <motion.span
          layoutId="chip-active"
          className="absolute inset-0 rounded-full bg-emerald-600"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      <span className="relative z-10">{label}</span>
    </button>
  );
}

/* ── Stat card ───────────────────────────────────────────────────────── */
interface StatCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
  borderGradient: string;
}

function StatCard({ title, value, icon: Icon, color, borderGradient }: StatCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.04, y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className="relative rounded-2xl p-px overflow-hidden"
    >
      <div className={cn("absolute inset-0 rounded-2xl bg-linear-to-br opacity-60", borderGradient)} />
      <div className="relative rounded-2xl bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {title}
            </p>
            <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
          </div>
          <div className={cn("rounded-xl p-2.5", color)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Pagination ──────────────────────────────────────────────────────── */
const ITEMS_PER_PAGE = 12;

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: number[] = [];
  for (let i = 1; i <= totalPages; i++) pages.push(i);

  return (
    <div className="flex items-center justify-center gap-1 pt-4">
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pages.map((page) => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={cn(
            "relative rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200",
            currentPage === page
              ? "text-white"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800",
          )}
        >
          {currentPage === page && (
            <motion.span
              layoutId="page-pill"
              className="absolute inset-0 rounded-lg bg-emerald-600"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10">{page}</span>
        </button>
      ))}
      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ── Dashboard ───────────────────────────────────────────────────────── */
const Dashboard = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<{
    urgentThreshold: number;
    warningThreshold: number;
  } | null>(null);
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL, ACTIVE, CONSUMED, DISCARDED
  const [urgencyFilter, setUrgencyFilter] = useState("ALL"); // ALL, EXPIRED, URGENT, NORMAL
  const [sort, setSort] = useState("NEWEST_FIRST"); // NEWEST_FIRST, OLDEST_FIRST, ALPHABETICAL, EXPIRATION_DATE
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [currentPage, setCurrentPage] = useState(1);

  /* Greeting */
  const getTimeOfDay = () => {
    const h = new Date().getHours();
    if (h < 6) return "Доброй ночи";
    if (h < 12) return "Доброе утро";
    if (h < 18) return "Добрый день";
    return "Добрый вечер";
  };

  const greeting = `${getTimeOfDay()}, ${session?.user?.name || "Гость"}!`;
  const typedGreeting = useTypingText(greeting);

  useEffect(() => {
    fetch(`/api/products`)
      .then((res) => res.json())
      .then((data) => setProducts(data.products || []));

    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => setSettings(data));
  }, []);

  // Open add-product dialog when navigated with ?barcode=...
  useEffect(() => {
    const bc = router.query.barcode;
    if (bc && typeof bc === "string") {
      setScannedBarcode(bc);
      setAddModalOpen(true);
      // Clean the URL without re-render
      router.replace("/dashboard", undefined, { shallow: true });
    }
  }, [router.query.barcode, router]);

  const updateProduct = (updatedProduct: Product) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p)),
    );
  };

  const addProduct = (product: Product) => {
    setProducts((prev) => [...prev, product]);
    setAddModalOpen(false); // Close modal after adding
    setScannedBarcode("");
  };

  const deleteProduct = (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  const onProductConsumed = (product: Product) => {
    updateProduct(product);
  };

  const onProductMovedToActive = (product: Product) => {
    updateProduct(product);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("ALL");
    setUrgencyFilter("ALL");
    setSort("NEWEST_FIRST");
    setCurrentPage(1);
  };

  const filteredProducts = products
    .filter((p) => {
      // Search filter
      const searchLower = searchTerm.toLowerCase();
      const nameMatch = p.name.toLowerCase().includes(searchLower);
      const barcodeMatch = p.barcode?.toLowerCase().includes(searchLower);

      if (searchTerm && !nameMatch && !barcodeMatch) {
        return false;
      }
      // Status filter
      if (statusFilter !== "ALL" && p.status !== statusFilter) {
        return false;
      }
      // Urgency filter
      const status = getExpiryStatus(
        new Date(p.expiryDate),
        settings?.urgentThreshold,
        settings?.warningThreshold,
      );

      if (urgencyFilter !== "ALL") {
        if (urgencyFilter === "EXPIRED" && status !== "expired") return false;
        if (urgencyFilter === "URGENT" && status !== "urgent") return false;
        if (
          urgencyFilter === "NORMAL" &&
          (status === "expired" || status === "urgent")
        )
          return false;
      }

      return true;
    })
    .sort((a, b) => {
      switch (sort) {
        case "NEWEST_FIRST":
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        case "OLDEST_FIRST":
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        case "ALPHABETICAL":
          return a.name.localeCompare(b.name);
        case "EXPIRATION_DATE":
          return (
            new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
          );
        default:
          return 0;
      }
    });

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, urgencyFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  /* Quick stats data */
  const stats = useMemo(() => {
    const total = products.length;
    const expiringSoon = products.filter((p) => {
      const s = getExpiryStatus(
        new Date(p.expiryDate),
        settings?.urgentThreshold,
        settings?.warningThreshold,
      );
      return s === "urgent" || s === "warning";
    }).length;
    const expired = products.filter(
      (p) =>
        getExpiryStatus(
          new Date(p.expiryDate),
          settings?.urgentThreshold,
          settings?.warningThreshold,
        ) === "expired",
    ).length;
    return { total, expiringSoon, expired };
  }, [products, settings]);

  /* Status chip options */
  const statusChips = [
    { label: "Все", value: "ALL" },
    { label: "Активные", value: "ACTIVE" },
    { label: "Использованные", value: "CONSUMED" },
    { label: "Выброшенные", value: "DISCARDED" },
  ];

  const urgencyChips = [
    { label: "Все", value: "ALL" },
    { label: "Просрочено", value: "EXPIRED" },
    { label: "Срочно", value: "URGENT" },
    { label: "В норме", value: "NORMAL" },
  ];

  const content = (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4">
      {/* ── Hero greeting ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        suppressHydrationWarning
      >
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground" suppressHydrationWarning>
          {typedGreeting}
          <span className="inline-block w-0.5 h-6 ml-1 bg-emerald-500 animate-[pulse_1s_steps(2)_infinite] align-middle" />
        </h1>
        <p className="mt-1 text-sm text-muted-foreground" suppressHydrationWarning>
          {filteredProducts.length} товаров · Сегодня{" "}
          {new Date().toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "long",
          })}
        </p>
      </motion.div>

      {/* ── Stats cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Всего товаров"
          value={stats.total}
          icon={Package}
          color="bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400"
          borderGradient="from-blue-400 to-cyan-400"
        />
        <StatCard
          title="Скоро истекает"
          value={stats.expiringSoon}
          icon={AlertTriangle}
          color="bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400"
          borderGradient="from-amber-400 to-orange-400"
        />
        <StatCard
          title="Просрочено"
          value={stats.expired}
          icon={XCircle}
          color="bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400"
          borderGradient="from-red-400 to-rose-500"
        />
      </div>

      {/* ── Toolbar: search + filters + view toggle ────────────────── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              aria-label="Search"
              placeholder="Поиск по названию..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Sort */}
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger aria-label="Sort by" className="w-auto min-w-[160px]">
              <SelectValue placeholder="Сначала новые" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NEWEST_FIRST">Сначала новые</SelectItem>
              <SelectItem value="OLDEST_FIRST">Сначала старые</SelectItem>
              <SelectItem value="ALPHABETICAL">По алфавиту</SelectItem>
              <SelectItem value="EXPIRATION_DATE">По сроку годности</SelectItem>
            </SelectContent>
          </Select>

          <ViewToggle value={viewMode} onChange={setViewMode} />

          <Button variant="outline" size="sm" onClick={resetFilters}>
            Сбросить
          </Button>
        </div>

        {/* Chip filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">
              Статус
            </span>
            {statusChips.map((c) => (
              <Chip
                key={c.value}
                label={c.label}
                active={statusFilter === c.value}
                onClick={() => setStatusFilter(c.value)}
              />
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">
              Срочность
            </span>
            {urgencyChips.map((c) => (
              <Chip
                key={c.value}
                label={c.label}
                active={urgencyFilter === c.value}
                onClick={() => setUrgencyFilter(c.value)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {paginatedProducts.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground"
          >
            <PackageOpen className="size-12 opacity-40" />
            <h3 className="text-lg font-semibold">Товары не найдены</h3>
            <p className="text-sm">Добавьте первый товар, чтобы начать.</p>
          </motion.div>
        ) : (
          <motion.div
            key={`page-${currentPage}-${viewMode}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className={cn(
              viewMode === "grid"
                ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                : "grid grid-cols-1 gap-3",
            )}
          >
            {paginatedProducts.map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
              >
                <ProductCard
                  product={product}
                  onProductDeleted={deleteProduct}
                  onProductConsumed={onProductConsumed}
                  onProductUpdated={updateProduct}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Pagination ─────────────────────────────────────────────── */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {/* Add product dialog */}
      <Dialog open={isAddModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Добавить товар</DialogTitle>
          </DialogHeader>
          <AddProductForm onProductAdded={addProduct} initialBarcode={scannedBarcode} />
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <>
      <div className="pb-36 md:pb-16">{content}</div>

      {/* FAB — fixed floating button */}
      <div className="fixed bottom-28 right-8 md:bottom-12 md:right-12 z-[100]">
        <button
          onClick={() => setAddModalOpen(true)}
          className="group relative bg-linear-to-r from-emerald-600 to-teal-500 text-white rounded-full p-4 shadow-2xl shadow-emerald-500/40 hover:shadow-emerald-500/60 transition-all duration-300 hover:scale-110"
          aria-label="Добавить новый товар"
        >
          <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
          <span className="absolute inset-0 rounded-full animate-ping bg-emerald-400/50" />
        </button>
      </div>
    </>
  );
};

export default Dashboard;
