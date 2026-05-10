import { useState, useEffect, useMemo, useCallback } from "react";
import { Product } from "@prisma/client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { getExpiryStatus, cn } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import AddProductForm from "../components/AddProductForm";
import EditProductForm from "../components/EditProductForm";
import ImportExcelModal from "../components/ImportExcelModal";
import { ProductTableEnhanced } from "@/components/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Trash2,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Archive,
  ListFilter,
  FileSpreadsheet,
} from "lucide-react";

/* ── Typing animation hook ── */
/** Hook that displays text character-by-character at a given speed. */
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

/* ── Debounce hook ── */
/** Returns a debounced copy of the value, updating after `delay` ms of inactivity. */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/* ── Chip filter ── */
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

/* ── Stat card ── */
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

/* ── Pagination ── */
const DEFAULT_ITEMS_PER_PAGE = 25;
const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage: number;
  onItemsPerPageChange: (value: number) => void;
}

function Pagination({ currentPage, totalPages, onPageChange, itemsPerPage, onItemsPerPageChange }: PaginationProps) {
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

      {/* Items per page selector */}
      <div className="flex items-center gap-2 ml-4 pl-4 border-l border-slate-200 dark:border-slate-700">
        <span className="text-sm text-slate-500">На странице:</span>
        <select
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          className="text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        >
          {ITEMS_PER_PAGE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

/* ── Dashboard ── */
/** Main dashboard page: product table, search, filters, stats, dialogs. */
const Dashboard = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<{
    urgentThreshold: number;
    warningThreshold: number;
  } | null>(null);
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [sortField, setSortField] = useState<"name" | "barcode" | "expiryDate" | "quantity" | "status" | "createdAt">("createdAt");
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  /* ── Data fetching ── */
  useEffect(() => {
    fetch(`/api/products`)
      .then((res) => res.json())
      .then((data) => setProducts(data.products || []));

    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => setSettings(data));
  }, []);

  /* ── Greeting ── */
  const getTimeOfDay = () => {
    const h = new Date().getHours();
    if (h < 6) return "Доброй ночи";
    if (h < 12) return "Доброе утро";
    if (h < 18) return "Добрый день";
    return "Добрый вечер";
  };

  const greeting = `${getTimeOfDay()}, ${session?.user?.name || "Гость"}!`;
  const typedGreeting = useTypingText(greeting);

  const updateProduct = (updatedProduct: Product) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p)),
    );
  };

  const addProduct = (product: Product) => {
    setProducts((prev) => [...prev, product]);
    setAddModalOpen(false);
  };

  const deleteProduct = async (productId: string) => {
    await fetch(`/api/products/${productId}`, { method: "DELETE" });
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
    setCurrentPage(1);
    setItemsPerPage(DEFAULT_ITEMS_PER_PAGE);
    setSelectedIds([]);
    setSortField("createdAt");
    setSortDesc(true);
  };

  /* ── Bulk actions ── */
  const handleBulkDelete = useCallback(async () => {
    setBulkBusy(true);
    await Promise.all(
      selectedIds.map((id) => fetch(`/api/products/${id}`, { method: "DELETE" }))
    );
    setProducts((prev) => prev.filter((p) => !selectedIds.includes(p.id)));
    setSelectedIds([]);
    setBulkBusy(false);
  }, [selectedIds]);

  const handleBulkStatus = useCallback(
    async (status: "ACTIVE" | "ARCHIVED" | "DEFECT") => {
      if (selectedIds.length === 0) return;
      setBulkBusy(true);
      const results = await Promise.all(
        selectedIds.map((id) =>
          fetch(`/api/products/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          }).then((r) => r.json() as Promise<Product>)
        )
      );
      setProducts((prev) =>
        prev.map((p) => {
          const updated = results.find((r) => r.id === p.id);
          return updated ?? p;
        })
      );
      setSelectedIds([]);
      setBulkBusy(false);
    },
    [selectedIds]
  );

  const filteredProducts = products
    .filter((p) => {
      // Text search (debounced)
      const searchLower = debouncedSearchTerm.toLowerCase();
      const nameMatch = p.name.toLowerCase().includes(searchLower);
      const barcodeMatch = p.barcode?.toLowerCase().includes(searchLower);

      if (debouncedSearchTerm && !nameMatch && !barcodeMatch) {
        return false;
      }

      // Status filter
      if (statusFilter !== "ALL") {
        if (statusFilter === "EXPIRED") {
          if (p.status !== "ACTIVE" || new Date(p.expiryDate) >= new Date()) return false;
        } else if (p.status !== statusFilter) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      let aVal: string | number | Date = "";
      let bVal: string | number | Date = "";

      switch (sortField) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "barcode":
          aVal = a.barcode?.toLowerCase() || "";
          bVal = b.barcode?.toLowerCase() || "";
          break;
        case "expiryDate":
          aVal = new Date(a.expiryDate).getTime();
          bVal = new Date(b.expiryDate).getTime();
          break;
        case "quantity":
          aVal = a.quantity ?? 0;
          bVal = b.quantity ?? 0;
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
        case "createdAt":
        default:
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
      }

      if (aVal < bVal) return sortDesc ? 1 : -1;
      if (aVal > bVal) return sortDesc ? -1 : 1;
      return 0;
    });

  // Reset to first page when filters or sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, sortField]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  /* ── Quick stats ── */
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

  /* ── Status chip options ── */
  const statusChips = [
    { label: "Все", value: "ALL" },
    { label: "Активные", value: "ACTIVE" },
    { label: "Просроченные", value: "EXPIRED" },
    { label: "Архив", value: "ARCHIVED" },
    { label: "Брак", value: "DEFECT" },
  ];

  const content = (
    <div className="mx-auto flex w-full flex-col gap-6 p-2">
      {/* Hero greeting */}
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

      {/* Stats cards */}
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

      {/* Toolbar: search + filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              aria-label="Search"
              placeholder="Поиск по названию и штрих-коду ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-emerald-200 dark:border-emerald-800 focus:border-emerald-500"
            />
          </div>

          <Button variant="outline" size="sm" onClick={resetFilters}>
            Сбросить
          </Button>

          <Button
            size="sm"
            onClick={() => setAddModalOpen(true)}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="h-4 w-4" />
            Добавить товар
          </Button>
        </div>

        {/* Status filter chips */}
        <div className="flex flex-wrap items-center gap-2">
          <ListFilter className="h-4 w-4 text-slate-400 shrink-0" />
          {statusChips.map((c) => (
            <Chip
              key={c.value}
              label={c.label}
              active={statusFilter === c.value}
              onClick={() => setStatusFilter(c.value)}
            />
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-4 py-3 shadow-lg"
          >
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300 mr-2">
              Выбрано: <span className="text-emerald-600 font-bold">{selectedIds.length}</span>
            </span>

            <Button
              size="sm"
              variant="outline"
              disabled={bulkBusy}
              onClick={() => handleBulkStatus("ACTIVE")}
              className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
            >
              {bulkBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              В Активные
            </Button>

            <Button
              size="sm"
              variant="outline"
              disabled={bulkBusy}
              onClick={() => handleBulkStatus("ARCHIVED")}
              className="gap-1.5 text-slate-600 border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {bulkBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Archive className="h-3.5 w-3.5" />
              )}
              В Архив
            </Button>

            <Button
              size="sm"
              variant="outline"
              disabled={bulkBusy}
              onClick={() => handleBulkStatus("DEFECT")}
              className="gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/30"
            >
              {bulkBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
              В Брак
            </Button>

            <Button
              size="sm"
              variant="outline"
              disabled={bulkBusy}
              onClick={handleBulkDelete}
              className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Удалить
            </Button>

            <Button
              size="sm"
              variant="ghost"
              disabled={bulkBusy}
              onClick={() => setSelectedIds([])}
              className="text-slate-500 ml-auto"
            >
              Отмена
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <AnimatePresence mode="wait">
        {filteredProducts.length === 0 ? (
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
            <Button
              size="sm"
              onClick={() => setAddModalOpen(true)}
              className="mt-2 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="h-4 w-4" />
              Добавить товар
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="table-view"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="w-full"
          >
            <ProductTableEnhanced
              products={paginatedProducts}
              urgentThreshold={settings?.urgentThreshold}
              warningThreshold={settings?.warningThreshold}
              selectedIds={selectedIds}
              sortField={sortField}
              sortDesc={sortDesc}
              onSortChange={(field) => {
                if (sortField === field) {
                  setSortDesc(!sortDesc);
                } else {
                  setSortField(field as typeof sortField);
                  setSortDesc(true);
                }
              }}
              onProductEdit={(p) => {
                setEditingProduct(p);
                setEditModalOpen(true);
              }}
              onProductUpdated={updateProduct}
              onProductDelete={(p) => deleteProduct(p.id)}
              onProductConsume={onProductConsumed}
              onProductMoveToActive={(p) => {
                fetch(`/api/products/${p.id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: "ACTIVE" }),
                })
                  .then((r) => r.json())
                  .then((updated) => updateProduct(updated));
              }}
              onProductArchive={(p) => {
                fetch(`/api/products/${p.id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: "ARCHIVED" }),
                })
                  .then((r) => r.json())
                  .then((updated) => updateProduct(updated));
              }}
              onProductDefect={(p) => {
                fetch(`/api/products/${p.id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: "DEFECT" }),
                })
                  .then((r) => r.json())
                  .then((updated) => updateProduct(updated));
              }}
              onSelectionChange={setSelectedIds}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={setItemsPerPage}
      />

      {/* Add product dialog */}
      <Dialog open={isAddModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Добавить товар</DialogTitle>
          </DialogHeader>

          <Button
            variant="outline"
            onClick={() => {
              setAddModalOpen(false);
              setIsImportOpen(true);
            }}
            className="flex items-center justify-center gap-2 w-full h-[46px] border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
          >
            <FileSpreadsheet className="size-5! text-emerald-600 shrink-0"/>
            Импорт из Excel
          </Button>

          <AddProductForm onProductAdded={addProduct} />
        </DialogContent>
      </Dialog>

      {/* Excel import dialog */}
      <ImportExcelModal
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImportComplete={() => {
          fetch("/api/products")
            .then((r) => r.json())
            .then((data) => setProducts(data.products ?? []));
        }}
      />

      {/* Edit product dialog */}
      <Dialog open={isEditModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Редактировать товар</DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <EditProductForm
              product={editingProduct}
              onProductUpdated={(updated) => {
                // Cast API response to match Prisma Product type
                const product = updated as Product;
                updateProduct(product);
                setEditModalOpen(false);
                setEditingProduct(null);
              }}
              onCancel={() => {
                setEditModalOpen(false);
                setEditingProduct(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <div className="pb-8">{content}</div>
  );
};

export default Dashboard;
