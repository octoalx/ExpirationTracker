import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { Product } from "@prisma/client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { getExpiryStatus, cn } from "../lib/utils";
import { exportProductsToExcel } from "../lib/excel-export";
import { motion, AnimatePresence } from "framer-motion";
import BarcodeCamera from "../components/BarcodeCamera";
import { findScannedProducts } from "@/lib/product-scan";
import { interactionFeedback } from "@/lib/interaction-feedback";
import toast from "react-hot-toast";
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
  ScanBarcode,
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
  Printer,
} from "lucide-react";

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
      aria-pressed={active}
      className={cn(
        "relative min-h-11 shrink-0 border-b-2 px-2 py-2 text-sm font-medium transition-colors duration-150",
        active
          ? "text-blue-700 border-blue-700"
          : "text-slate-600 border-transparent hover:text-blue-700",
      )}
    >
      <span className="relative z-10">{label}</span>
    </button>
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

  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => Math.max(1, Math.min(currentPage - 2, totalPages - 4)) + index);

  return (
    <div className="flex flex-wrap items-center justify-center gap-1 pt-4">
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
            "relative min-h-11 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-200",
            currentPage === page
              ? "text-white"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800",
          )}
        >
          {currentPage === page && (
            <motion.span
              layoutId="page-pill"
              className="absolute inset-0 rounded-lg bg-blue-600"
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
          className="text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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
  const [scanOpen, setScanOpen] = useState(false);
  const [scanCameraOpen, setScanCameraOpen] = useState(false);
  const [scanCode, setScanCode] = useState("");
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [initialBarcode, setInitialBarcode] = useState("");
  const [scanBusy, setScanBusy] = useState(false);
  const [scanError, setScanError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const scanVersion = useRef(0);
  const scanLock = useRef(false);
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
  const openedEditId = useRef<string | null>(null);
  useEffect(() => {
    const editId = typeof router.query.edit === "string" ? router.query.edit : null;
    if (!editId) { openedEditId.current = null; return; }
    if (openedEditId.current === editId) return;
    const product = products.find(item => item.id === editId);
    if (product) {
      openedEditId.current = editId;
      setEditingProduct(product);
      setEditModalOpen(true);
      const { edit: _edit, ...query } = router.query;
      void router.replace({ pathname: router.pathname, query }, undefined, { shallow: true, scroll: false });
    }
  }, [router, products]);


  const loadProducts = useCallback(async () => {
    setLoading(true); setLoadError("");
    try {
      const response = await fetch("/api/products");
      if (!response.ok) throw new Error("Не удалось загрузить товары. Повторите попытку.");
      const data = await response.json(); setProducts(data.products ?? []);
    } catch (error) { setLoadError(error instanceof Error ? error.message : "Ошибка сети"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void loadProducts();
    fetch("/api/settings").then(res => res.ok ? res.json() : null).then(setSettings).catch(() => {});
  }, [loadProducts]);

  const closeScan = useCallback(() => {
    scanVersion.current++; scanLock.current = false;
    setScanOpen(false); setScanCameraOpen(false); setScanBusy(false);
  }, []);
  const resolveScan = useCallback(async (rawCode: string) => {
    const code = rawCode.trim();
    if (!/^\d{8,14}$/.test(code)) { setScanError("Введите штрих-код из 8–14 цифр."); return; }
    if (scanLock.current) return;
    scanLock.current = true;
    const version = ++scanVersion.current;
    setScanCode(code); setScanCameraOpen(false); setScanBusy(true); setScanError("");
    try {
      const response = await fetch("/api/products");
      if (!response.ok) throw new Error("Не удалось проверить товары. Повторите поиск — код сохранён.");
      const data = await response.json();
      if (version !== scanVersion.current) return;
      const inventory: Product[] = data.products ?? [];
      setProducts(inventory); setLoading(false); setLoadError("");
      closeScan(); interactionFeedback("scan");
      if (findScannedProducts(inventory, code).length) {
        setSearchTerm(""); setScannedBarcode(code); setStatusFilter("ALL"); setCurrentPage(1);
        toast.success("Товар найден. Показаны все записи по штрих-коду.");
      } else {
        setInitialBarcode(code); setAddModalOpen(true);
      }
    } catch (error) {
      if (version === scanVersion.current) setScanError(error instanceof Error ? error.message : "Ошибка сети. Повторите поиск.");
    } finally {
      if (version === scanVersion.current) { scanLock.current = false; setScanBusy(false); }
    }
  }, [closeScan]);
  const closeCamera = useCallback(() => setScanCameraOpen(false), []);
  const openScan = () => { setScanError(""); setScanCode(""); setScanOpen(true); setScanCameraOpen(true); };
  const openAdd = () => { setInitialBarcode(""); setAddModalOpen(true); };

  const updateProduct = (updatedProduct: Product) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p)),
    );
  };

  const addProduct = (product: Product) => {
    setProducts((prev) => [...prev, product]);
    setAddModalOpen(false);
    setScannedBarcode(product.barcode ?? "");
    setSearchTerm(""); setStatusFilter("ALL"); setCurrentPage(1);
  };

  const deleteProduct = async (productId: string) => {
    try {
      const response = await fetch(`/api/products/${productId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Не удалось удалить товар. Повторите попытку.");
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      toast.success("Товар удалён");
    } catch { toast.error("Не удалось удалить товар. Повторите попытку."); }
  };

  const onProductConsumed = (product: Product) => {
    updateProduct(product);
  };

  const onProductMovedToActive = (product: Product) => {
    updateProduct(product);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setScannedBarcode("");
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
      if (scannedBarcode && p.barcode !== scannedBarcode) return false;
      // Text search (debounced)
      const searchLower = debouncedSearchTerm.toLowerCase();
      const nameMatch = p.name.toLowerCase().includes(searchLower);
      const barcodeMatch = p.barcode?.toLowerCase().includes(searchLower);

      if (debouncedSearchTerm && !nameMatch && !barcodeMatch) {
        return false;
      }

      // Status filter
      if (statusFilter !== "ALL") {
        if (statusFilter === "EXPIRED" || statusFilter === "SOON") {
          const urgency = getExpiryStatus(p.expiryDate, settings?.urgentThreshold, settings?.warningThreshold);
          if (p.status !== "ACTIVE" || !p.expiryDate) return false;
          if (statusFilter === "EXPIRED" ? urgency !== "expired" : urgency !== "urgent" && urgency !== "warning") return false;
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
          aVal = a.expiryDate ? new Date(a.expiryDate).getTime() : Number.POSITIVE_INFINITY;
          bVal = b.expiryDate ? new Date(b.expiryDate).getTime() : Number.POSITIVE_INFINITY;
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
  }, [searchTerm, scannedBarcode, statusFilter, sortField, itemsPerPage]);

  const handleBulkPrint = useCallback(() => {
    const selected = filteredProducts.filter((p) => selectedIds.includes(p.id));
    if (selected.length === 0) return;
    exportProductsToExcel(selected, session?.user?.name ?? undefined);
  }, [filteredProducts, selectedIds, session]);

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
        p.expiryDate,
        settings?.urgentThreshold,
        settings?.warningThreshold,
      );
      return s === "urgent" || s === "warning";
    }).length;
    const expired = products.filter(
      (p) =>
        getExpiryStatus(
          p.expiryDate,
          settings?.urgentThreshold,
          settings?.warningThreshold,
        ) === "expired",
    ).length;
    return { total, expiringSoon, expired };
  }, [products, settings]);

  /* ── Status chip options ── */
  const statusChips = [
    { label: "Все", value: "ALL" },
    { label: "Скоро истекает", value: "SOON" },
    { label: "Просрочено", value: "EXPIRED" },
  ];

  const content = (
    <div className="inventory-page mx-auto flex w-full max-w-7xl flex-col gap-5">
      <header className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-3 work-page-title">Товары <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-base font-medium tabular-nums text-slate-600">{products.length}</span></h1>
        <Button variant="outline" onClick={openAdd} className="min-h-11 gap-2"><Plus className="size-4" /><span>Добавить</span></Button>
      </header>
      <div className="hidden gap-6 text-sm text-slate-600 md:flex"><span>Всего: {stats.total}</span><span>Скоро истекает: {stats.expiringSoon}</span><span>Просрочено: {stats.expired}</span></div>
      {/* Toolbar: search + filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              aria-label="Поиск товаров"
              placeholder="Название или штрих-код"
              value={searchTerm}
              onChange={(e) => { setScannedBarcode(""); setSearchTerm(e.target.value); }}
              className="h-12 pl-10 text-base bg-white border-slate-200 focus:border-blue-700"
            />
          </div>

          <Button variant="outline" size="sm" onClick={resetFilters} className="hidden md:inline-flex">
            Сбросить
          </Button>

          <button type="button" onClick={openScan} className="primary-action w-full md:w-auto"><ScanBarcode className="size-6" />Сканировать товар</button>
        </div>

        {scannedBarcode && <div role="status" className="scan-result flex flex-wrap items-center justify-between gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900"><span>Штрих-код <strong className="tabular-nums">{scannedBarcode}</strong> · Найдено: {filteredProducts.length}</span><button className="min-h-11 font-medium underline underline-offset-4" onClick={resetFilters}>Все товары</button></div>}
        {/* Status filter chips */}
        <div className="flex items-center gap-1 border-b border-slate-200">
          {statusChips.map((c) => (
            <Chip
              key={c.value}
              label={c.label}
              active={statusFilter === c.value}
              onClick={() => setStatusFilter(c.value)}
            />
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 text-sm">
          <label className="flex items-center gap-2 text-slate-600"><ListFilter className="size-4" /><span className="sr-only">Состояние товаров</span><select className="min-h-11 rounded-lg bg-transparent pr-2" aria-label="Состояние товаров" value={["ACTIVE", "ARCHIVED", "DEFECT"].includes(statusFilter) ? statusFilter : "ALL"} onChange={event => { setStatusFilter(event.target.value); }}><option value="ALL">Все состояния</option><option value="ACTIVE">Активные</option><option value="ARCHIVED">Архив</option><option value="DEFECT">Брак</option></select></label>
          {(searchTerm || scannedBarcode || statusFilter !== "ALL") && <button className="min-h-11 px-2 text-blue-700 md:hidden" onClick={resetFilters}>Сбросить</button>}
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
              Выбрано: <span className="text-blue-600 font-bold">{selectedIds.length}</span>
            </span>

            <Button
              size="sm"
              variant="outline"
              disabled={bulkBusy}
              onClick={() => handleBulkStatus("ACTIVE")}
              className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950/30"
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
              onClick={handleBulkPrint}
              className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950/30"
            >
              <Printer className="h-3.5 w-3.5" />
              Печать
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

      {loadError && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{loadError}<button className="ml-3 min-h-11 underline" onClick={() => void loadProducts()}>Повторить</button></div>}
      {loading && <p role="status" className="flex items-center gap-2 py-8 text-slate-600"><Loader2 className="size-5 animate-spin" />Загружаем товары…</p>}
      {/* Content */}
      <AnimatePresence mode="wait">
        {loading || loadError ? null : filteredProducts.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground"
          >
            <PackageOpen className="size-12 opacity-40" />
            <h3 className="text-lg font-semibold">Товары не найдены</h3>
            <p className="text-sm">Измените фильтры или добавьте товар, чтобы начать.</p>
            <Button
              size="sm"
              onClick={openAdd}
              className="mt-2 gap-1.5 bg-blue-700 hover:bg-blue-800 text-white"
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

      <Dialog open={scanOpen} onOpenChange={open => { if (!open) closeScan(); }}>
        <DialogContent className="work-panel product-dialog sm:max-w-lg max-h-[90dvh] overflow-y-auto" aria-describedby="scan-description" onOpenAutoFocus={event => { if (window.matchMedia("(max-width: 767px)").matches) event.preventDefault(); }}>
          <DialogHeader><DialogTitle>Сканировать товар</DialogTitle></DialogHeader>
          <p id="scan-description" className="text-sm text-slate-600">Найдём записи по штрих-коду. Если товара нет в списке, откроем добавление.</p>
          {scanCameraOpen && <BarcodeCamera onDetected={resolveScan} onClose={closeCamera} />}
          {!scanCameraOpen && !scanBusy && <button className="entry-link min-h-11 text-blue-700" onClick={() => setScanCameraOpen(true)}>Открыть камеру</button>}
          <form className="product-entry space-y-3" onSubmit={event => { event.preventDefault(); void resolveScan(scanCode); }}>
            <label htmlFor="scan-code">Или введите штрих-код</label><input id="scan-code" inputMode="numeric" value={scanCode} onChange={event => setScanCode(event.target.value)} disabled={scanBusy} />
            {scanError && <p role="alert" className="text-sm text-red-800">{scanError}</p>}
            <button disabled={scanBusy || !scanCode.trim()} className="primary-action w-full">{scanBusy ? <><Loader2 className="size-5 animate-spin" />Проверяем товары…</> : "Найти товар"}</button>
          </form>
        </DialogContent>
      </Dialog>
      {/* Add product dialog */}
      <Dialog open={isAddModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="work-panel product-dialog sm:max-w-lg max-h-[90dvh] overflow-y-auto" aria-describedby={undefined} onOpenAutoFocus={event => { event.preventDefault(); if (!window.matchMedia("(max-width: 767px)").matches) document.getElementById(initialBarcode ? "add-expiry" : "add-barcode")?.focus(); }}>
          <DialogHeader>
            <DialogTitle>Добавить товар</DialogTitle>
          </DialogHeader>

          <details>
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-slate-700">Добавить несколько товаров из файла</summary>
          <p className="mb-3 text-sm text-slate-600">Загрузите список из Excel вместо ручного ввода каждого товара.</p>
          <Button
            variant="outline"
            onClick={() => {
              setAddModalOpen(false);
              setIsImportOpen(true);
            }}
            className="flex items-center justify-center gap-2 w-full h-[46px] border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/30"
          >
            <FileSpreadsheet className="size-5! text-blue-600 shrink-0"/>
            Импорт из Excel
          </Button>
          </details>

          <AddProductForm onProductAdded={addProduct} initialBarcode={initialBarcode} />
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
        <DialogContent className="work-panel sm:max-w-md max-h-[90dvh] overflow-y-auto">
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
