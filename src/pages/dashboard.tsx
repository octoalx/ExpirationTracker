import { useState, useEffect } from "react";
import { Product, Settings } from "@prisma/client";
import { useSession } from "next-auth/react";
import ProductCard from "../components/ProductCard";
import { getExpiryStatus } from "../lib/utils";
import { Plus } from "lucide-react";
import AddProductForm from "../components/AddProductForm";
import Modal from "../components/Modal";

const QuickStats = ({ products = [], settings }) => {
  const total = products.length;
  const expiringSoon = products.filter(
    (p) =>
      getExpiryStatus(
        new Date(p.expiryDate),
        settings?.urgentThreshold,
        settings?.warningThreshold,
      ) === "urgent" ||
      getExpiryStatus(
        new Date(p.expiryDate),
        settings?.urgentThreshold,
        settings?.warningThreshold,
      ) === "warning",
  ).length;
  const expired = products.filter(
    (p) =>
      getExpiryStatus(
        new Date(p.expiryDate),
        settings?.urgentThreshold,
        settings?.warningThreshold,
      ) === "expired",
  ).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-gray-500">Всего товаров</h3>
        <p className="text-2xl font-bold">{total}</p>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-gray-500">Скоро истекает</h3>
        <p className="text-2xl font-bold text-amber-600">{expiringSoon}</p>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-gray-500">Просрочено</h3>
        <p className="text-2xl font-bold text-rose-600">{expired}</p>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { data: session } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<{
    urgentThreshold: number;
    warningThreshold: number;
  } | null>(null);
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL, ACTIVE, CONSUMED, DISCARDED
  const [urgencyFilter, setUrgencyFilter] = useState("ALL"); // ALL, EXPIRED, URGENT, NORMAL
  const [sort, setSort] = useState("NEWEST_FIRST"); // NEWEST_FIRST, OLDEST_FIRST, ALPHABETICAL, EXPIRATION_DATE

  useEffect(() => {
    fetch(`/api/products`)
      .then((res) => res.json())
      .then((data) => setProducts(data.products || []));

    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => setSettings(data));
  }, []);

  const updateProduct = (updatedProduct: Product) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p)),
    );
  };

  const addProduct = (product: Product) => {
    setProducts((prev) => [...prev, product]);
    setAddModalOpen(false); // Close modal after adding
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

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto p-4">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">
            Привет, {session?.user?.name || "Гость"}
          </h1>
        </header>

        <QuickStats products={products} settings={settings} />

        <main>
          <div className="bg-white p-4 rounded-lg shadow mb-8">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <input
                type="text"
                placeholder="Поиск по названию..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">Все статусы</option>
                <option value="ACTIVE">Активные</option>
                <option value="CONSUMED">Использованные</option>
                <option value="DISCARDED">Выброшенные</option>
              </select>
              <select
                value={urgencyFilter}
                onChange={(e) => setUrgencyFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">Все</option>
                <option value="EXPIRED">Просрочено</option>
                <option value="URGENT">Срочно</option>
                <option value="NORMAL">В норме</option>
              </select>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="NEWEST_FIRST">Сначала новые</option>
                <option value="OLDEST_FIRST">Сначала старые</option>
                <option value="ALPHABETICAL">По алфавиту</option>
                <option value="EXPIRATION_DATE">По сроку годности</option>
              </select>
              <button
                onClick={resetFilters}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm shadow-sm text-slate-500 hover:bg-slate-50 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                Сбросить фильтры
              </button>
            </div>
          </div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-700">Все товары</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts?.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onProductDeleted={deleteProduct}
                onProductConsumed={onProductConsumed}
                onProductMovedToActive={onProductMovedToActive}
                settings={settings}
              />
            ))}
            {(!filteredProducts || filteredProducts.length === 0) && (
              <div className="col-span-full text-center text-gray-500">
                <p>Ничего не найдено по вашему запросу.</p>
              </div>
            )}
          </div>
        </main>
      </div>

      <button
        onClick={() => setAddModalOpen(true)}
        className="fixed bottom-8 right-8 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform duration-300"
        aria-label="Добавить новый товар"
      >
        <Plus size={32} />
      </button>

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Добавить новый продукт"
      >
        <AddProductForm onProductAdded={addProduct} />
      </Modal>
    </div>
  );
};

export default Dashboard;
