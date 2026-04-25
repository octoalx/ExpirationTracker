import { Product } from "@prisma/client";
import { PackageOpen } from "lucide-react";
import ProductCard from "./ProductCard";

interface ProductGridProps {
  products: Product[];
  settings: any;
  onProductDeleted: (id: string) => void;
  onProductConsumed: (product: Product) => void;
  onProductMovedToActive: (product: Product) => void;
  onProductUpdated: (product: Product) => void;
}

export function ProductGrid({
  products,
  onProductDeleted,
  onProductConsumed,
  onProductMovedToActive,
  onProductUpdated,
}: ProductGridProps) {
  if (!products || products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
        <PackageOpen className="size-12 opacity-40" />
        <h3 className="text-lg font-semibold">Товары не найдены</h3>
        <p className="text-sm">Добавьте первый товар, чтобы начать.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-fr">
      {products.map((product) => ( 
        <ProductCard
          key={product.id}
          product={product}
          onProductDeleted={onProductDeleted}
          onProductConsumed={onProductConsumed}
          onProductUpdated={onProductUpdated}
        />
      ))}
    </div>
  );
}
