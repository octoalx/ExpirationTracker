import { useState, useEffect } from "react";
import { Product } from "@prisma/client";
import dynamic from "next/dynamic";

const ScannerModal = dynamic(() => import("../components/ScannerModal"), {
  ssr: false,
});

const Dashboard = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isScannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then(setProducts);
  }, []);

  const addProduct = (product: Product) => {
    setProducts((prev) => [...prev, product]);
  };

  const handleScanSuccess = async (barcode: string) => {
    // Here you would typically fetch product details from your API
    // For now, we'll just create a dummy product
    const newProduct: Product = {
      id: new Date().toISOString(),
      name: `Product with barcode ${barcode}`,
      barcode: barcode,
      expiryDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: "1",
    };
    addProduct(newProduct);
    setScannerOpen(false);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 no-print">Dashboard</h1>
      <button
        onClick={() => setScannerOpen(true)}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded no-print"
      >
        Scan Barcode
      </button>

      {isScannerOpen && (
        <ScannerModal
          onClose={() => setScannerOpen(false)}
          onScanSuccess={handleScanSuccess}
        />
      )}

      <div id="print-area">
        <h2 className="text-xl font-semibold my-4">Product List</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products?.map((product) => (
            <div key={product.id} className="p-4 border rounded shadow">
              <p className="font-semibold">{product.name}</p>
              <p>Barcode: {product.barcode}</p>
              <p>
                Expires on: {new Date(product.expiryDate).toLocaleDateString()}
              </p>
            </div>
          ))}
          {(!products || products.length === 0) && <p>No products found.</p>}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
