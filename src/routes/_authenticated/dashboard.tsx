/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Boxes,
  CircleDollarSign,
  Package,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { db } from "@/lib/crud";
import { money, num, dateTime } from "@/lib/format";
import { PageHeader, SectionCard, StatCard, StatusBadge } from "@/components/ui-kit";
import { DataTable } from "@/components/DataTable";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — My Shop" },
      { name: "description", content: "Live sales, profit, stock and debt overview for My Shop." },
      { property: "og:title", content: "Dashboard — My Shop" },
      { property: "og:description", content: "Live sales, profit, stock and debt overview." },
    ],
  }),
  component: Dashboard,
});

function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [invoices, items, products, stock, customers] = await Promise.all([
        db.from("invoices").select("id, invoice_number, total, paid_amount, status, is_credit_sale, created_at, customers(name)").order("created_at", { ascending: false }),
        db.from("invoice_items").select("product_id, quantity, unit_price, cost_price, total, invoices(created_at, status)"),
        db.from("products").select("id, name, sku, reorder_level, cost_price, is_active"),
        db.from("stock_levels").select("product_id, warehouse_id, quantity"),
        db.from("customers").select("id, current_balance"),
      ]);

      const invRows: any[] = invoices.data ?? [];
      const valid = invRows.filter((i) => i.status !== "void" && i.status !== "cancelled");
      const totalSales = valid.reduce((s, i) => s + Number(i.total), 0);
      const monthSales = valid
        .filter((i) => new Date(i.created_at) >= monthStart)
        .reduce((s, i) => s + Number(i.total), 0);

      const itemRows: any[] = (items.data ?? []).filter((r: any) => r.invoices?.status !== "void");
      const profit = itemRows.reduce(
        (s, r) => s + (Number(r.total) - Number(r.cost_price ?? 0) * Number(r.quantity)),
        0,
      );

      const stockRows: any[] = stock.data ?? [];
      const byProduct = new Map<string, number>();
      for (const s of stockRows) byProduct.set(s.product_id, (byProduct.get(s.product_id) ?? 0) + Number(s.quantity));

      const prodRows: any[] = (products.data ?? []).filter((p: any) => p.is_active);
      const lowStock = prodRows
        .map((p) => ({ ...p, onHand: byProduct.get(p.id) ?? 0 }))
        .filter((p) => p.onHand <= Number(p.reorder_level ?? 0));

      const inventoryValue = prodRows.reduce(
        (s, p) => s + (byProduct.get(p.id) ?? 0) * Number(p.cost_price ?? 0),
        0,
      );

      const outstanding = (customers.data ?? []).reduce((s: number, c: any) => s + Number(c.current_balance ?? 0), 0);

      const soldByProduct = new Map<string, { qty: number; revenue: number }>();
      for (const r of itemRows) {
        const cur = soldByProduct.get(r.product_id) ?? { qty: 0, revenue: 0 };
        cur.qty += Number(r.quantity);
        cur.revenue += Number(r.total);
        soldByProduct.set(r.product_id, cur);
      }
      const nameById = new Map(prodRows.map((p) => [p.id, p.name]));
      const topProducts = [...soldByProduct.entries()]
        .map(([id, v]) => ({ id, name: nameById.get(id) ?? "Unknown", ...v }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);

      return {
        totalSales,
        monthSales,
        profit,
        productCount: prodRows.length,
        lowStock,
        inventoryValue,
        outstanding,
        recent: invRows.slice(0, 8),
        topProducts,
      };
    },
  });
}

function Dashboard() {
  const { data, isLoading } = useDashboard();

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Live figures straight from the operations database." />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total sales" value={money(data?.totalSales)} icon={<Receipt className="size-4" />} tone="primary" />
        <StatCard label="This month" value={money(data?.monthSales)} icon={<TrendingUp className="size-4" />} tone="success" />
        <StatCard label="Gross profit" value={money(data?.profit)} hint="Revenue less cost of goods" icon={<CircleDollarSign className="size-4" />} tone="success" />
        <StatCard label="Outstanding debts" value={money(data?.outstanding)} icon={<AlertTriangle className="size-4" />} tone="destructive" />
        <StatCard label="Products" value={num(data?.productCount)} icon={<Package className="size-4" />} />
        <StatCard label="Inventory value" value={money(data?.inventoryValue)} hint="Quantity x cost price" icon={<Boxes className="size-4" />} />
        <StatCard label="Low stock alerts" value={num(data?.lowStock?.length)} hint="At or below reorder level" icon={<AlertTriangle className="size-4" />} tone="warning" />
        <StatCard label="Recent invoices" value={num(data?.recent?.length)} icon={<Receipt className="size-4" />} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SectionCard title="Recent sales" action={<Link className="text-xs text-primary" to="/sales">View all</Link>}>
            <DataTable
              loading={isLoading}
              rows={data?.recent ?? []}
              empty="No invoices recorded yet."
              pageSize={8}
              columns={[
                { key: "invoice_number", header: "Invoice" },
                { key: "customer", header: "Customer", render: (r: any) => r.customers?.name ?? "Walk-in" },
                { key: "total", header: "Total", render: (r: any) => money(r.total) },
                { key: "status", header: "Status", render: (r: any) => <StatusBadge status={r.status} /> },
                { key: "created_at", header: "Date", render: (r: any) => dateTime(r.created_at) },
              ]}
            />
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Top selling products">
            <ul className="space-y-3">
              {(data?.topProducts ?? []).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{p.name}</span>
                  <span className="num shrink-0 text-muted-foreground">{num(p.qty)} pcs</span>
                </li>
              ))}
              {!data?.topProducts?.length && <li className="text-sm text-muted-foreground">No sales yet.</li>}
            </ul>
          </SectionCard>

          <SectionCard title="Low stock alerts" action={<Link className="text-xs text-primary" to="/inventory">Restock</Link>}>
            <ul className="space-y-3">
              {(data?.lowStock ?? []).slice(0, 6).map((p: any) => (
                <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{p.name}</span>
                  <span className="num shrink-0 text-destructive">
                    {num(p.onHand)} / {num(p.reorder_level)}
                  </span>
                </li>
              ))}
              {!data?.lowStock?.length && <li className="text-sm text-muted-foreground">All products above reorder level.</li>}
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
