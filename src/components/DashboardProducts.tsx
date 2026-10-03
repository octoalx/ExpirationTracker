"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { type Product } from "@prisma/client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  PackageOpen,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  FileSpreadsheet,
  Printer,
} from "lucide-react";

import { getExpiryStatus } from "@/lib/utils";
import { exportProductsToExcel } from "@/lib/excel-export";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import AddProductForm from "@/components/AddProductForm";
import ImportExcelModal from "@/components/ImportExcelModal";
import { ProductStats } from "@/components/ProductStats";
import { ProductTableEnhanced } from "@/components/products/ProductTableEnhanced";

interface Settings {
  urgentThreshold: number;
  warningThreshold: number;
}

type BulkStatus = "ACTIVE" | "CONSUMED" | "DISCARDED";

/** Main dashboard view: product list, stats, bulk actions, add/edit/import dialogs. */
export function DashboardProducts() {
  const { data: session } = useSession();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  const [isImportOpen, setIsImportOpen] = useState(false);

  const [bulkIds, setBulkIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  /* ── Initial data load ─────────────────────────────────────────────── */
  useEffect(() => {
    Promise.all([
      fetch("/api/products").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]).then(([productsData, settingsData]) => {
      setProducts(productsData.products ?? []);
      setSettings(settingsData);
      setLoading(false);
    });
  }, []);

  /* ── Open add-form when barcode arrives via URL query ────────────── */
  useEffect(() => {
    const bc = router.query.barcode;
    if (bc && typeof bc === "string") {
      setScannedBarcode(bc);
      setIsAddOpen(true);
      router.replace("/dashboard", undefined, { shallow: true });
    }
  }, [router.query.barcode, router]);

  /* ── Product mutations ───────────────────────────────────────────── */
  const addProduct = useCallback((product: Product) => {
    setProducts((prev) => [...prev, product]);
    setIsAddOpen(false);
    setScannedBarcode("");
  }, []);

  const updateProduct = useCallback((updated: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setEditProduct(null);
  }, []);

  const deleteProduct = useCallback((productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  }, []);

  /* ── Table callbacks ─────────────────────────────────────────────── */
  const handleEdit = useCallback((product: Product) => {
    setEditProduct(product);
    setIsAddOpen(true);
  }, []);

  const handleDelete = useCallback(
    async (product: Product) => {
      await fetch(`/api/products/${product.id}`, { method: "DELETE" });
      deleteProduct(product.id);
    },
    [deleteProduct]
  );

  const handleConsume = useCallback(
    async (product: Product) => {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CONSUMED" }),
      });
      if (res.ok) updateProduct(await res.json());
    },
    [updateProduct]
  );

  /* ── Bulk actions ────────────────────────────────────────────────── */
  const handleBulkDelete = useCallback(async () => {
    setBulkBusy(true);
    await Promise.all(
      bulkIds.map((id) => fetch(`/api/products/${id}`, { method: "DELETE" }))
    );
    setProducts((prev) => prev.filter((p) => !bulkIds.includes(p.id)));
    setBulkIds([]);
    setBulkBusy(false);
    setConfirmDelete(false);
  }, [bulkIds]);

  const handleBulkStatus = useCallback(
    async (status: BulkStatus) => {
      setBulkBusy(true);
      const results = await Promise.all(
        bulkIds.map((id) =>
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
      setBulkIds([]);
      setBulkBusy(false);
    },
    [bulkIds]
  );

  const handleBulkPrint = useCallback(() => {
    const selected = products.filter((p) => bulkIds.includes(p.id));
    if (selected.length === 0) return;
    exportProductsToExcel(selected, session?.user?.name ?? undefined);
  }, [products, bulkIds, session]);

  /* ── Computed stats ───────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const ut = settings?.urgentThreshold ?? 3;
    const wt = settings?.warningThreshold ?? 7;
    const today = new Date();

    const active = products.filter((p) => p.status === "ACTIVE");

    const expired = active.filter(
      (p) => p.expiryDate && getExpiryStatus(new Date(p.expiryDate), ut, wt) === "expired"
    ).length;

    const expiring7 = active.filter((p) => {
      if (!p.expiryDate) return false;
      const days = Math.ceil(
        (new Date(p.expiryDate).getTime() - today.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      return days >= 0 && days <= 7;
    }).length;

    const expiring30 = active.filter((p) => {
      if (!p.expiryDate) return false;
      const days = Math.ceil(
        (new Date(p.expiryDate).getTime() - today.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      return days >= 0 && days <= 30;
    }).length;

    return { total: products.length, expired, expiring7, expiring30 };
  }, [products, settings]);

  /* ── Time-of-day greeting ─────────────────────────────────────────── */
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    const time =
      h < 6
        ? "Доброй ночи"
        : h < 12
        ? "Доброе утро"
        : h < 18
        ? "Добрый день"
        : "Добрый вечер";
    return `${time}, ${session?.user?.name ?? "Гость"}!`;
  }, [session]);

  /* ── Bulk action bar ─────────────────────────────────────────────── */
  const actionBar = bulkIds.length > 0 && (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-4 py-3 shadow-lg"
    >
      <span className="text-sm font-medium text-slate-600 dark:text-slate-300 mr-2">
        Выбрано: <span className="text-emerald-600 font-bold">{bulkIds.length}</span>
      </span>

      <Button
        size="sm"
        variant="outline"
        disabled={bulkBusy}
        onClick={() => handleBulkStatus("CONSUMED")}
        className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950/30"
      >
        {bulkBusy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5" />
        )}
        Использованы
      </Button>

      <Button
        size="sm"
        variant="outline"
        disabled={bulkBusy}
        onClick={() => handleBulkStatus("DISCARDED")}
        className="gap-1.5 text-slate-600 border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        {bulkBusy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <XCircle className="h-3.5 w-3.5" />
        )}
        Выброшены
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
        onClick={() => setConfirmDelete(true)}
        className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Удалить
      </Button>

      <Button
        size="sm"
        variant="ghost"
        disabled={bulkBusy}
        onClick={() => setBulkIds([])}
        className="text-slate-500 ml-auto"
      >
        Отмена
      </Button>
    </motion.div>
  );

  /* ── Render ────────────────────────────────────────────────────────── */
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-wrap items-start justify-between gap-3"
        suppressHydrationWarning
      >
        <div suppressHydrationWarning>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            {greeting}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {products.length} товаров · Сегодня{" "}
            {new Date().toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>

        <Button
          onClick={() => { setEditProduct(null); setIsAddOpen(true); }}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
        >
          <Plus className="h-4 w-4" />
          Добавить товар
        </Button>
      </motion.div>

      {/* Stats cards */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
      >
        <ProductStats
          total={stats.total}
          expired={stats.expired}
          expiring7={stats.expiring7}
          expiring30={stats.expiring30}
        />
      </motion.div>

      {/* Product table + action bar + FAB */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/70 backdrop-blur-sm p-4 shadow-sm"
      >
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-24 text-muted-foreground gap-3"
            >
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Загрузка товаров...</span>
            </motion.div>
          ) : products.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground"
            >
              <PackageOpen className="h-12 w-12 opacity-40" />
              <h3 className="text-lg font-semibold">Нет товаров</h3>
              <p className="text-sm">Добавьте первый товар, чтобы начать.</p>
              <Button
                size="sm"
                onClick={() => setIsAddOpen(true)}
                className="mt-2 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Plus className="h-4 w-4" />
                Добавить товар
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="table"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ProductTableEnhanced
                products={products}
                urgentThreshold={settings?.urgentThreshold}
                warningThreshold={settings?.warningThreshold}
                onProductEdit={handleEdit}
                onProductDelete={handleDelete}
                onProductRemoved={deleteProduct}
                onProductConsume={handleConsume}
                onSelectionChange={setBulkIds}
                actionBar={actionBar}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* FAB below table */}
        {products.length > 0 && (
          <div className="flex justify-end mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => { setEditProduct(null); setIsAddOpen(true); }}
              className="group relative bg-linear-to-r from-emerald-600 to-teal-500 text-white rounded-full p-4 shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all duration-300 hover:scale-110"
              aria-label="Добавить товар"
            >
              <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
              <span className="absolute inset-0 rounded-full animate-ping bg-emerald-400/50" />
            </button>
          </div>
        )}
      </motion.div>

      {/* Add / Edit product dialog */}
      <Dialog
        open={isAddOpen}
        onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) { setEditProduct(null); setScannedBarcode(""); }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editProduct ? "Редактировать товар" : "Добавить товар"}
            </DialogTitle>
            <DialogDescription>
              {editProduct
                ? "Измените данные товара"
                : "Заполните форму или импортируйте из Excel"}
            </DialogDescription>
          </DialogHeader>

          {!editProduct && (
            <Button
              variant="outline"
              onClick={() => {
                setIsAddOpen(false);
                setIsImportOpen(true);
              }}
              className="gap-2 w-full mb-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Импорт из Excel
            </Button>
          )}

          <AddProductForm
            onProductAdded={addProduct}
            initialBarcode={scannedBarcode}
          />
        </DialogContent>
      </Dialog>

      {/* Excel import dialog */}
      <ImportExcelModal
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImportComplete={() => {
          // Refresh product list after import
          fetch("/api/products")
            .then((r) => r.json())
            .then((data) => setProducts(data.products ?? []));
        }}
      />

      {/* Bulk delete confirmation */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Удалить {bulkIds.length} товаров?</DialogTitle>
            <DialogDescription>
              Это действие необратимо. Все выбранные товары будут удалены.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              disabled={bulkBusy}
              onClick={() => setConfirmDelete(false)}
            >
              Отмена
            </Button>
            <Button
              disabled={bulkBusy}
              onClick={handleBulkDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {bulkBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Удалить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
