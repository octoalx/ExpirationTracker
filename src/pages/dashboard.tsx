import { watchInventorySettings } from "@/lib/inventory-settings";
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
import { groupByExpiryStatus, groupExpiringFirst, sliceGroups, sortProductsByExpiry } from "@/lib/days-left";
import { createPendingDeletes, type PendingDeletes } from "@/lib/pending-delete";
import { expiryDays } from "@/lib/expiry-calendar";
import { useIsDesktop } from "@/lib/media-query";
import toast from "react-hot-toast";
import AddProductForm from "../components/AddProductForm";
import EditProductForm from "../components/EditProductForm";
import ImportExcelModal from "../components/ImportExcelModal";
import { ProductTableEnhanced, type ProductStatus } from "@/components/products";
import { DashboardSummary, type SummaryFilter } from "@/components/products/DashboardSummary";
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
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  PackageOpen,
  Trash2,
  CheckCircle2,
  Loader2,
  Archive,
  ListFilter,
  FileSpreadsheet,
  AlertTriangle,
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
/** The single undo window shared by every delete on this screen. */
const DELETE_DELAY_MS = 6000;

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
        aria-label="Предыдущая страница"
        className="min-h-11 min-w-11 rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-colors"
      >
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
      </button>
      {pages.map((page) => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={cn(
            "relative min-h-11 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-200",
            currentPage === page
              ? "text-white"
              : "text-slate-600 hover:bg-slate-100",
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
        aria-label="Следующая страница"
        className="min-h-11 min-w-11 rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-colors"
      >
        <ChevronRight aria-hidden="true" className="h-4 w-4" />
      </button>

      {/* Items per page selector */}
      <div className="flex w-full items-center justify-center gap-2 pt-2 md:ml-4 md:w-auto md:border-l md:border-slate-200 md:pl-4 md:pt-0">
        <span className="text-sm text-slate-500">На странице:</span>
        <select
          value={itemsPerPage}
          aria-label="Товаров на странице"
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          className="text-sm rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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
/** Main dashboard page: summary-filters, FEFO table, group-aware phone list. */
const Dashboard = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<{
    urgentThreshold: number;
    warningThreshold: number;
  } | null>(null);
  const [referenceDate, setReferenceDate] = useState(() => new Date());
  const [scanOpen, setScanOpen] = useState(false);
  const [scanCameraOpen, setScanCameraOpen] = useState(false);
  const [scanCode, setScanCode] = useState("");
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [initialBarcode, setInitialBarcode] = useState("");
  const [scanBusy, setScanBusy] = useState(false);
  const [scanError, setScanError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [canDelete, setCanDelete] = useState(false);
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  /** Rows hidden while the 6-second undo window is open. */
  const [pendingIds, setPendingIds] = useState<string[]>([]);

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

  const productsRef = useRef(products);
  productsRef.current = products;

  /* ── Deferred delete: rows leave the list at once and are committed after 6 s ── */
  const pendingDeletes = useRef<PendingDeletes | null>(null);
  const deleteBatch = useRef<string[]>([]);
  const deleteToastId = useRef<string | null>(null);
  if (!pendingDeletes.current) {
    pendingDeletes.current = createPendingDeletes({
      delayMs: DELETE_DELAY_MS,
      commit: async (id, { keepalive }) => {
        const product = productsRef.current.find(p => p.id === id);
        try {
          const response = await fetch(`/api/products/${id}?version=${product?.version ?? 0}`, { method: "DELETE", keepalive });
          if (!response.ok) {
            const data = await response.json().catch(() => null);
            throw new Error(data?.message ?? "Не удалось удалить товар.");
          }
          setProducts(prev => prev.filter(p => p.id !== id));
          setPendingIds(prev => prev.filter(pendingId => pendingId !== id));
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Не удалось удалить товар.");
          throw error;
        }
      },
      onRestore: (id) => setPendingIds(prev => prev.filter(pendingId => pendingId !== id)),
    });
  }

  useEffect(() => {
    const pending = pendingDeletes.current;
    if (!pending) return;
    const flushPending = () => pending.flush();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushPending();
    };
    window.addEventListener("pagehide", flushPending);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flushPending);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const scheduleDelete = useCallback((ids: string[]) => {
    const pending = pendingDeletes.current;
    if (!pending) return;
    const fresh = ids.filter(id => !pending.has(id));
    if (fresh.length === 0) return;
    deleteBatch.current = fresh;
    setPendingIds(prev => [...new Set([...prev, ...fresh])]);
    setSelectedIds([]);
    fresh.forEach(id => pending.schedule(id));
    if (deleteToastId.current) toast.dismiss(deleteToastId.current);
    deleteToastId.current = toast(
      (t) => (
        <span className="flex items-center gap-3">
          <span>Товар удалён</span>
          <button
            type="button"
            className="min-h-9 rounded-md px-2 py-1 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            onClick={() => {
              for (const id of deleteBatch.current) pendingDeletes.current?.undo(id);
              toast.dismiss(t.id);
              deleteToastId.current = null;
            }}
          >
            Отменить
          </button>
        </span>
      ),
      { duration: DELETE_DELAY_MS },
    );
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true); setLoadError("");
    try {
      const response = await fetch("/api/products");
      const data = await response.json().catch(() => null);
      // The server explains a missing department; keep that text instead of a generic retry.
      if (!response.ok) throw new Error(data?.message ?? "Не удалось загрузить товары. Повторите попытку.");
      setProducts(data.products ?? []); setCanDelete(data.canDelete ?? true);
    } catch (error) { setLoadError(error instanceof Error ? error.message : "Ошибка сети"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.hidden) return;
      fetch("/api/products").then(async response => {
        if (response.ok) {
          const data = await response.json();
          setProducts(data.products ?? []); setCanDelete(data.canDelete ?? true);
        }
      }).catch(() => {});
    }, 10000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (router.query.add === "1") {
      setAddModalOpen(true);
      const { add: _add, ...query } = router.query;
      void router.replace({ pathname: router.pathname, query }, undefined, { shallow: true });
    }
  }, [router]);
  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);
  useEffect(() => watchInventorySettings((next, now) => { setSettings(next); setReferenceDate(now); }, setReferenceDate), []);

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
  /** The scanner is a phone tool: on a computer the button, the dialog and the camera do not exist. */
  const isDesktop = useIsDesktop();
  useEffect(() => { if (isDesktop) closeScan(); }, [isDesktop, closeScan]);

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

  const onProductStatusChange = useCallback((product: Product, status: ProductStatus) => {
    fetch(`/api/products/${product.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, version: product.version }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) { toast.error(data.message ?? "Не удалось изменить статус."); return; }
        updateProduct(data as Product);
      })
      .catch(() => toast.error("Не удалось изменить статус."));
  }, []);

  const resetFilters = () => {
    setSearchTerm("");
    setScannedBarcode("");
    setStatusFilter("ALL");
    setCurrentPage(1);
    setItemsPerPage(DEFAULT_ITEMS_PER_PAGE);
    setSelectedIds([]);
  };

  /* ── Bulk actions ── */
  const handleBulkDelete = useCallback(() => {
    if (selectedIds.length === 0) return;
    scheduleDelete(selectedIds);
  }, [selectedIds, scheduleDelete]);

  const handleBulkStatus = useCallback(
    async (status: "ACTIVE" | "ARCHIVED" | "DEFECT") => {
      if (selectedIds.length === 0) return;
      setBulkBusy(true);
      const results = await Promise.all(
        selectedIds.map((id) =>
          fetch(`/api/products/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status, version: products.find(p => p.id === id)?.version }),
          }).then(async r => { const data = await r.json(); if (!r.ok) { toast.error(data.message); return null; } return data as Product; })
        )
      );
      setProducts((prev) =>
        prev.map((p) => {
          const updated = results.find((r) => r?.id === p.id);
          return updated ?? p;
        })
      );
      setSelectedIds([]);
      setBulkBusy(false);
    },
    [selectedIds, products]
  );

  /** Rows that still exist locally; deferred deletes stay hidden while undo is possible. */
  const visibleProducts = useMemo(
    () => products.filter((product) => !pendingIds.includes(product.id)),
    [products, pendingIds],
  );

  const filteredProducts = useMemo(() => visibleProducts.filter((p) => {
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
        const urgency = getExpiryStatus(p.expiryDate, settings?.urgentThreshold, settings?.warningThreshold, referenceDate);
        if (p.status !== "ACTIVE" || !p.expiryDate) return false;
        if (statusFilter === "EXPIRED" ? urgency !== "expired" : urgency !== "urgent" && urgency !== "warning") return false;
      } else if (p.status !== statusFilter) {
        return false;
      }
    }

    return true;
  }), [visibleProducts, scannedBarcode, debouncedSearchTerm, statusFilter, settings, referenceDate]);

  // FEFO: the closest expiry date leads, records without a date close the list.
  const fefoProducts = useMemo(() => sortProductsByExpiry(filteredProducts, referenceDate), [filteredProducts, referenceDate]);

  const groupOptions = useMemo(() => ({
    now: referenceDate,
    urgentThreshold: settings?.urgentThreshold,
    warningThreshold: settings?.warningThreshold,
  }), [referenceDate, settings]);

  /* Grouping runs over the whole filtered set, so pages only slice it. */
  const desktopGroups = useMemo(() => groupExpiringFirst(fefoProducts, groupOptions), [fefoProducts, groupOptions]);
  const phoneGroups = useMemo(() => groupByExpiryStatus(fefoProducts, groupOptions), [fefoProducts, groupOptions]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, scannedBarcode, statusFilter, itemsPerPage]);

  const exportFiltered = useCallback(() => {
    if (fefoProducts.length === 0) return;
    void exportProductsToExcel(fefoProducts, session?.user?.name ?? undefined);
  }, [fefoProducts, session]);

  const exportSelected = useCallback(() => {
    const selected = fefoProducts.filter((p) => selectedIds.includes(p.id));
    if (selected.length === 0) return;
    void exportProductsToExcel(selected, session?.user?.name ?? undefined);
  }, [fefoProducts, selectedIds, session]);

  const totalPages = Math.max(1, Math.ceil(fefoProducts.length / itemsPerPage));
  const pageStart = (currentPage - 1) * itemsPerPage;
  const pageEnd = pageStart + itemsPerPage;
  const pageProducts = fefoProducts.slice(pageStart, pageEnd);
  const desktopPageGroups = sliceGroups(desktopGroups, pageStart, pageEnd);
  const phonePageGroups = sliceGroups(phoneGroups, pageStart, pageEnd);

  /* ── Summary numbers ── */
  const stats = useMemo(() => {
    const summary = { total: visibleProducts.length, expiringSoon: 0, expired: 0, urgent: 0, warning: 0, active: 0, archived: 0, defect: 0, maxOverdueDays: 0 };
    for (const product of visibleProducts) {
      if (product.status === "ACTIVE") summary.active += 1;
      else if (product.status === "ARCHIVED") summary.archived += 1;
      else if (product.status === "DEFECT") summary.defect += 1;
      if (product.status !== "ACTIVE" || !product.expiryDate) continue;
      const urgency = getExpiryStatus(product.expiryDate, settings?.urgentThreshold, settings?.warningThreshold, referenceDate);
      if (urgency === "expired") {
        summary.expired += 1;
        const days = expiryDays(product.expiryDate, referenceDate);
        if (days !== null) summary.maxOverdueDays = Math.max(summary.maxOverdueDays, -days);
      } else if (urgency === "urgent" || urgency === "warning") {
        summary.expiringSoon += 1;
        if (urgency === "urgent") summary.urgent += 1;
        else summary.warning += 1;
      }
    }
    return summary;
  }, [visibleProducts, settings, referenceDate]);

  const summaryFilter: SummaryFilter | "OTHER" =
    statusFilter === "EXPIRED" || statusFilter === "SOON" || statusFilter === "ALL" ? statusFilter : "OTHER";

  /* ── Status chip options ── */
  const statusChips = [
    { label: "Все", value: "ALL" },
    { label: "Скоро истекает", value: "SOON" },
    { label: "Просрочено", value: "EXPIRED" },
  ];

  const content = (
    <div className="inventory-page mx-auto flex w-full max-w-7xl flex-col gap-4 md:gap-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="work-page-title">Товары</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setIsImportOpen(true)} className="min-h-11 gap-2"><FileSpreadsheet aria-hidden="true" className="size-4" /><span>Импорт из Excel</span></Button>
          <Button onClick={openAdd} className="min-h-11 gap-2"><Plus aria-hidden="true" className="size-4" /><span>Добавить</span></Button>
        </div>
      </header>
      <DashboardSummary
        expired={stats.expired}
        expiring={stats.expiringSoon}
        total={stats.total}
        maxOverdueDays={stats.maxOverdueDays}
        urgent={stats.urgent}
        warning={stats.warning}
        active={stats.active}
        archived={stats.archived}
        defect={stats.defect}
        filter={summaryFilter}
        onFilterChange={(next) => setStatusFilter(next)}
      />
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
              className="h-12 pl-10 pr-10 text-base bg-white border-slate-200 focus:border-blue-700"
            />
            {searchTerm && (
              <button
                type="button"
                aria-label="Очистить поиск"
                onClick={(e) => { e.stopPropagation(); setScannedBarcode(""); setSearchTerm(""); setCurrentPage(1); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-8 items-center justify-center rounded-full text-[#1554b5] transition-colors hover:text-[#12479a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            )}
          </div>

          {/* Phone-only: the camera is the first way in on a handset, and there is none on a desktop. */}
          {!isDesktop && <button type="button" onClick={openScan} className="primary-action w-full md:hidden"><ScanBarcode className="size-6" />Сканировать товар</button>}
        </div>

        {scannedBarcode && <div role="status" className="scan-result flex flex-wrap items-center justify-between gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900"><span>Штрих-код <strong className="tabular-nums">{scannedBarcode}</strong> · Показаны записи по этому коду</span><button className="min-h-11 font-medium underline underline-offset-4" onClick={resetFilters}>Все товары</button></div>}
        {/* Status filter chips */}
        <div className="flex items-center gap-1 border-b border-slate-200 !mt-4">
          {statusChips.map((c) => (
            <Chip
              key={c.value}
              label={c.label}
              active={statusFilter === c.value}
              onClick={() => setStatusFilter(c.value)}
            />
          ))}
        </div>
        <div className="!mt-1 flex flex-wrap items-center justify-between gap-2 text-sm">
          <label className="flex items-center gap-2 text-slate-600"><ListFilter className="size-4" /><span className="sr-only">Состояние товаров</span><select className="min-h-11 rounded-lg bg-transparent pr-2" aria-label="Состояние товаров" value={["ACTIVE", "ARCHIVED", "DEFECT"].includes(statusFilter) ? statusFilter : "ALL"} onChange={event => { setStatusFilter(event.target.value); }}><option value="ALL">Все состояния</option><option value="ACTIVE">Активные</option><option value="ARCHIVED">Архив</option><option value="DEFECT">Брак</option></select></label>
          <button
            type="button"
            onClick={exportFiltered}
            disabled={fefoProducts.length === 0}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[#1554b5] hover:bg-blue-50 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <FileSpreadsheet aria-hidden="true" className="size-4" />
            Экспорт в Excel
          </button>
          {(searchTerm || scannedBarcode || statusFilter !== "ALL") && <button type="button" className="hidden min-h-11 items-center px-2 text-sm font-semibold text-[#1554b5] hover:text-[#12479a] md:inline-flex" aria-label="Сбросить фильтры" onClick={resetFilters}>Сбросить</button>}
        </div>
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="hidden flex-wrap items-center gap-2 rounded-xl border border-slate-200 md:flex bg-white/90 backdrop-blur-sm px-4 py-3 shadow-lg"
          >
            <span className="text-sm font-medium text-slate-600 mr-2">
              Выбрано: <span className="text-blue-600 font-bold">{selectedIds.length}</span>
            </span>

            <Button
              size="sm"
              variant="outline"
              disabled={bulkBusy}
              onClick={() => handleBulkStatus("ACTIVE")}
              className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
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
              className="gap-1.5 text-slate-600 border-slate-200 hover:bg-slate-50"
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
              className="gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50"
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
              onClick={exportSelected}
              className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Экспорт в Excel
            </Button>

            {canDelete && <Button
              size="sm"
              variant="outline"
              disabled={bulkBusy}
              onClick={handleBulkDelete}
              className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Удалить
            </Button>}

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
              products={pageProducts}
              groups={desktopPageGroups}
              mobileGroups={phonePageGroups}
              urgentThreshold={settings?.urgentThreshold}
              warningThreshold={settings?.warningThreshold}
              referenceDate={referenceDate}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onProductEdit={(p) => {
                setEditingProduct(p);
                setEditModalOpen(true);
              }}
              onProductDelete={(p) => scheduleDelete([p.id])}
              onProductStatusChange={onProductStatusChange}
              onProductRemoved={(id) => setProducts((prev) => prev.filter((p) => p.id !== id))}
              canDelete={canDelete}
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

      {/* Scanner dialog stays out of the desktop render: nothing on a computer may open the camera. */}
      {!isDesktop && <Dialog open={scanOpen} onOpenChange={open => { if (!open) closeScan(); }}>
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
      </Dialog>}
      {/* Add product dialog */}
      <Dialog open={isAddModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="work-panel product-dialog sm:max-w-lg max-h-[90dvh] overflow-y-auto" aria-describedby={undefined} onOpenAutoFocus={event => { event.preventDefault(); if (!window.matchMedia("(max-width: 767px)").matches) document.getElementById(initialBarcode ? "add-expiry" : "add-barcode")?.focus(); }}>
          <DialogHeader>
            <DialogTitle>Добавить товар</DialogTitle>
          </DialogHeader>

          {/* On a phone the header holds one button, so the file route is a plain row here. */}
          <button
            type="button"
            className="entry-link md:hidden self-start"
            onClick={() => { setAddModalOpen(false); setIsImportOpen(true); }}
          >
            Импорт из Excel
          </button>

          <AddProductForm onProductAdded={addProduct} initialBarcode={initialBarcode} onCancel={() => setAddModalOpen(false)} />
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
        <DialogContent className="work-panel product-dialog sm:max-w-md max-h-[90dvh] overflow-y-auto" onOpenAutoFocus={event => event.preventDefault()}>
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
    <div className="pb-24 md:pb-8">{content}</div>
  );
};

export default Dashboard;
