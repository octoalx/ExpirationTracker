import React, { useState, useEffect } from 'react';
import Head from 'next/head';

// Placeholder for product data fetching and filtering logic
interface Product {
  id: string;
  name: string;
  productionDate: Date;
  expirationDate: Date;
}

const Dashboard: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<'all' | 'expiring' | 'expired'>('all');

  // Placeholder for fetching products
  useEffect(() => {
    // In a real app, you would fetch data from your API or directly from Prisma
    const dummyProducts: Product[] = [
      { id: '1', name: 'Milk', productionDate: new Date('2024-04-10'), expirationDate: new Date('2024-04-20') },
      { id: '2', name: 'Bread', productionDate: new Date('2024-04-12'), expirationDate: new Date('2024-04-18') },
      { id: '3', name: 'Cheese', productionDate: new Date('2024-03-15'), expirationDate: new Date('2024-05-01') },
      { id: '4', name: 'Yogurt', productionDate: new Date('2024-04-18'), expirationDate: new Date('2024-04-22') },
    ];
    setProducts(dummyProducts);
  }, []);

  const filteredProducts = products.filter(product => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expirationDate = new Date(product.expirationDate);
    expirationDate.setHours(0, 0, 0, 0);
    const daysUntilExpiration = Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    switch (filter) {
      case 'expiring':
        // Assuming 'expiring soon' means within the next 7 days
        return daysUntilExpiration >= 0 && daysUntilExpiration <= 7;
      case 'expired':
        return daysUntilExpiration < 0;
      case 'all':
      default:
        return true;
    }
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="container mx-auto p-4">
      <Head>
        <title>Dashboard - Expiration Tracker</title>
      </Head>

      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

      {/* Filters */}
      <div className="mb-6 flex space-x-4">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded ${filter === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          All Products
        </button>
        <button
          onClick={() => setFilter('expiring')}
          className={`px-4 py-2 rounded ${filter === 'expiring' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          Expiring Soon
        </button>
        <button
          onClick={() => setFilter('expired')}
          className={`px-4 py-2 rounded ${filter === 'expired' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          Expired
        </button>
      </div>

      {/* Product Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2 text-left">Product Name</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Expiration Date</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length > 0 ? (
              filteredProducts.map(product => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const expirationDate = new Date(product.expirationDate);
                expirationDate.setHours(0, 0, 0, 0);
                const daysUntilExpiration = Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                let status = 'Active';
                if (daysUntilExpiration < 0) {
                  status = 'Expired';
                } else if (daysUntilExpiration <= 7) {
                  status = 'Expiring Soon';
                }

                return (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2">{product.name}</td>
                    <td className="border border-gray-300 px-4 py-2">{expirationDate.toLocaleDateString()}</td>
                    <td className={`border border-gray-300 px-4 py-2 font-medium ${
                      status === 'Expired' ? 'text-red-500' : status === 'Expiring Soon' ? 'text-yellow-500' : 'text-green-500'
                    }`}>
                      {status}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={3} className="border border-gray-300 px-4 py-2 text-center">
                  No products found for the selected filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Print Report Button */}
      <div className="mt-6">
        <button
          onClick={handlePrint}
          className="px-6 py-3 bg-green-500 text-white rounded-lg shadow-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
        >
          Print Report
        </button>
      </div>

      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .container, .container * {
            visibility: visible;
          }
          .container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
          }
          /* Hide filters and print button when printing */
          .container > div:nth-child(-n+3), /* Filters */
          .container > div:last-child { /* Print button */
            display: none;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            border: 1px solid #ccc;
            padding: 8px;
            text-align: left;
          }
          th {
            background-color: #f0f0f0;
          }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
