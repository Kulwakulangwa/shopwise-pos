# ShopWise POS

Project Knowledge — Wholesale Electronics Inventory & POS call it my shop

Business: wholesale/retail electronics (TVs, ACs, refrigerators, washing machines, similar appliances). Stack: Supabase for auth + database (schema already defined — see schema.sql, run it via Supabase migration before building UI). React + Tailwind + shadcn/ui for frontend. No barcode scanning module.

Roles

Owner: full access, all modules, financial reports

Manager: inventory, sales, purchasing, customers, suppliers — no system settings

Cashier: POS, sales, viewing stock levels only

Storekeeper: inventory, stock in/out, stock adjustments, goods receiving

Pages / Modules (build in this order)

Dashboard: total sales, monthly revenue, profit summary, total products, low stock alerts, outstanding debts, recent sales, top selling products. Pull all figures live from Supabase, no mock data.

Inventory Management: product categories, product CRUD, stock in, stock out, stock adjustments, warehouse management, serial number tracking (only for products where tracks_serial = true), low stock alerts, inventory valuation (quantity x cost_price per warehouse).

Sales Management: quotations (convertible to sales orders), sales orders, invoices, POS screen (fast checkout, keyboard-friendly, supports serial number selection when required), returns & refunds (auto-restock unless marked otherwise), sales history with filters.

Customer Management: customer profiles, statements (running ledger of invoices + payments), credit sales flag on invoices, outstanding balances, purchase history per customer.

Supplier Management: supplier profiles, purchase orders, supplier invoices, supplier payments.

Purchasing: purchase requests (internal, need approval before becoming a PO), purchase orders, goods receiving (updates stock_levels and stock_movements on receipt), purchase history.

Credit Management: customer credit limits (block or warn at POS when a sale would exceed the limit), debt tracking, payment records, aging report (0-30/31-60/61-90/90+ days).

Warranty Management: warranty registration (auto-created from invoice_items when product has a warranty period), warranty claims workflow (open -> in_service -> resolved/rejected), product service history.

Finance: income, expenses, cashbook (ledger of all cash in/out tied to bank_accounts), bank accounts, profit & loss, financial reports.

Staff Management: employee records, roles (from the roles table), permissions per role, activity logs (write one on every create/update/delete of sales, stock, and finance records).

Reports & Analytics: sales, inventory, profit, customer, supplier, and debt reports — filterable by date range and exportable to CSV.

Hidden Admin (owner-only, separate route, not in main nav): user management, roles & permissions, system settings, audit logs, backup & restore.

Business rules to enforce

Every sale reduces stock_levels and writes a stock_movements row (type 'out').

Every goods receipt increases stock_levels and writes a stock_movements row (type 'in').

Invoices with is_credit_sale = true increase the customer's current_balance; customer_payments reduce it.

Block or flag (owner-configurable) a credit sale that would push current_balance above credit_limit.

Low stock alert fires when a product's total quantity across warehouses <= reorder_level.

Warranty auto-generated on invoice completion for products with a warranty period set.

All monetary fields are TZS, 2 decimal places.

What NOT to build

No barcode scanning or barcode label printing.

No multi-currency support.

No public storefront — this is an internal operations tool.

Style

Clean SaaS dashboard look, sidebar navigation grouped by the modules above, card-based summary tiles on the dashboard, data tables with search/filter/pagination throughout.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c000c6bd-23cc-46b8-a98d-9c207e11c70b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
