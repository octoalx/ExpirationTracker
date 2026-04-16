// types/index.ts

export interface User {
  id: string;
  email: string; // Added email field
  notifyDaysBefore: number;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  telegramChatId?: string;
  products: Product[]; // Added relation to products
}

export interface Product {
  id: string;
  name: string;
  productionDate: Date;
  expirationDate: Date;
  // Note: The schema does not define a foreign key for User on Product,
  // so Product does not directly reference User here.
  // If a product belongs to a user, the User model would need a `products` field,
  // and Product might need a `userId` field.
  // Based on the schema change, User now has `products: Product[]`.
}
