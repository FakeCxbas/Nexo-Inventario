import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  check,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const branches = sqliteTable('branches', {
  id: text().primaryKey(),
  name: text().notNull(),
  city: text().notNull(),
  kind: text().notNull(),
});
export const suppliers = sqliteTable('suppliers', {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull(),
  phone: text().notNull(),
});
export const products = sqliteTable(
  'products',
  {
    id: text().primaryKey(),
    name: text().notNull(),
    sku: text().notNull().unique(),
    barcode: text().notNull().default(''),
    category: text().notNull(),
    unit: text().notNull(),
    cost: real().notNull(),
    price: real().notNull(),
    minimum: integer().notNull(),
    supplier: text().references(() => suppliers.id),
    expiry: text().notNull().default(''),
  },
  (t) => [
    check(
      'positive_cost',
      sql`${t.cost} >= 0 AND ${t.price} >= 0 AND ${t.minimum} >= 0`,
    ),
  ],
);
export const stock = sqliteTable(
  'stock',
  {
    product: text()
      .notNull()
      .references(() => products.id),
    branch: text()
      .notNull()
      .references(() => branches.id),
    quantity: integer().notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.product, t.branch] }),
    check('nonnegative_stock', sql`${t.quantity} >= 0`),
  ],
);
export const movements = sqliteTable('movements', {
  id: text().primaryKey(),
  product: text()
    .notNull()
    .references(() => products.id),
  branch: text()
    .notNull()
    .references(() => branches.id),
  destination: text().references(() => branches.id),
  type: text().notNull(),
  quantity: integer().notNull(),
  note: text().notNull(),
  created: text().notNull(),
});
