/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Package,
  Users,
  Truck,
  CreditCard,
  Download,
  Calendar,
  Filter,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useRows } from "@/lib/crud";
import { money, date } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports & Analytics — My Shop" },
      { name: "description", content: "Sales, inventory, profit, customer, supplier, and debt reports." },
    ],
  }),
  component: Reports,
});

function Reports() {
  const [dateFrom, setDateFrom] = useState(
    new Date(new Date().setDate(1)).toISOString().slice(0, 10)
  );
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [reportTab, setReportTab] = useState<
    "sales" | "inventory" | "profit" | "customers" | "suppliers" | "aging"
  >("sales");

  // Fetch all necessary data
  const invoices = useRows("invoices", {
    filters: [
      ["status", "!=", "cancelled"],
      ["status", "!=", "draft"],
    ],
  });
  const invoiceItems = useRows("invoice_items");
  const products = useRows("products", { select: "id, name, sku, cost_price, selling_price, reorder_level" });
  const stock = useRows("stock_levels");
  const warehouses = useRows("warehouses");
  const customers = useRows("customers");
  const suppliers = useRows("suppliers");
  const cashbook = useRows("cashbook");
  const purchaseOrders = useRows("purchase_orders", {
    filters: [["status", "!=", "cancelled"]],
  });

  // Filter invoices by date range
  const filteredInvoices = useMemo(() => {
    let list = (invoices.data ?? []) as any[];
    if (dateFrom) {
      list = list.filter((inv) => inv.created_at >= dateFrom);
    }
    if (dateTo) {
      list = list.filter((inv) => inv.created_at <= dateTo + "T23:59:59");
    }
    return list;
  }, [invoices.data, dateFrom, dateTo]);

  // Compute sales report data
  const salesReport = useMemo(() => {
    const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);
    const totalInvoices = filteredInvoices.length;
    const paidInvoices = filteredInvoices.filter((inv) => inv.status === "paid").length;
    const creditInvoices = filteredInvoices.filter((inv) => inv.is_credit_sale).length;

    // Top products by quantity sold
    const productSales = new Map<string, { name: string; sku: string; qty: number; revenue: number }>();
    const invoiceIds = new Set(filteredInvoices.map((inv) => inv.id));
    for (const item of (invoiceItems.data ?? []) as any[]) {
      if (!invoiceIds.has(item.invoice_id)) continue;
      const pid = item.product_id;
      const existing = productSales.get(pid) || { name: "", sku: "", qty: 0, revenue: 0 };
      const prod = (products.data ?? []).find((p: any) => p.id === pid);
      existing.name = prod?.name || pid;
      existing.sku = prod?.sku || "";
      existing.qty += Number(item.quantity);
      existing.revenue += Number(item.total);
      productSales.set(pid, existing);
    }
    const topProducts = Array.from(productSales.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Top customers by spend
    const customerSpend = new Map<string, { name: string; total: number; count: number }>();
    for (const inv of filteredInvoices) {
      if (!inv.customer_id) continue;
      const existing = customerSpend.get(inv.customer_id) || { name: "", total: 0, count: 0 };
      const cust = (customers.data ?? []).find((c: any) => c.id === inv.customer_id);
      existing.name = cust?.name || "Unknown";
      existing.total += Number(inv.total);
      existing.count += 1;
      customerSpend.set(inv.customer_id, existing);
    }
    const topCustomers = Array.from(customerSpend.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    return {
      totalRevenue,
      totalInvoices,
      paidInvoices,
      creditInvoices,
      topProducts,
      topCustomers,
    };
  }, [filteredInvoices, invoiceItems.data, products.data, customers.data]);

  // Inventory report
  const inventoryReport = useMemo(() => {
    const stockMap = new Map<string, { warehouse: string; quantity: number }[]>();
    for (const s of (stock.data ?? []) as any[]) {
      const pid = s.product_id;
      if (!stockMap.has(pid)) stockMap.set(pid, []);
      const wh = (warehouses.data ?? []).find((w: any) => w.id === s.warehouse_id);
      stockMap.get(pid)!.push({
        warehouse: wh?.name || s.warehouse_id,
        quantity: Number(s.quantity),
      });
    }
    const report: any[] = [];
    for (const p of (products.data ?? []) as any[]) {
      const stockEntries = stockMap.get(p.id) || [];
      const totalQty = stockEntries.reduce((sum, e) => sum + e.quantity, 0);
      const totalValue = totalQty * Number(p.cost_price);
      const isLowStock = p.reorder_level && totalQty <= Number(p.reorder_level);
      report.push({
        id: p.id,
        name: p.name,
        sku: p.sku,
        cost_price: Number(p.cost_price),
        selling_price: Number(p.selling_price),
        totalQty,
        totalValue,
        stockEntries,
        reorder_level: p.reorder_level ? Number(p.reorder_level) : null,
        isLowStock,
      });
    }
    report.sort((a, b) => b.totalValue - a.totalValue);
    return report;
  }, [products.data, stock.data, warehouses.data]);

  // Profit report
  const profitReport = useMemo(() => {
    // Revenue from filtered invoices
    const revenue = filteredInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);

    // COGS: sum of cost_price * quantity from invoice_items linked to filtered invoices
    const invoiceIds = new Set(filteredInvoices.map((inv) => inv.id));
    let cogs = 0;
    for (const item of (invoiceItems.data ?? []) as any[]) {
      if (!invoiceIds.has(item.invoice_id)) continue;
      cogs += Number(item.cost_price) * Number(item.quantity);
    }

    // Expenses: cash out (excluding supplier payments? We'll treat all out as expense for simplicity)
    let expenses = 0;
    for (const entry of (cashbook.data ?? []) as any[]) {
      if (entry.direction === "out") {
        // Optionally filter by date?
        expenses += Number(entry.amount);
      }
    }

    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - expenses;

    return {
      revenue,
      cogs,
      grossProfit,
      expenses,
      netProfit,
    };
  }, [filteredInvoices, invoiceItems.data, cashbook.data]);

  // Customer report: list all customers with total spend, invoice count, outstanding
  const customerReport = useMemo(() => {
    const report = new Map<string, { name: string; phone: string; totalSpent: number; invoiceCount: number; outstanding: number }>();
    for (const c of (customers.data ?? []) as any[]) {
      report.set(c.id, {
        name: c.name,
        phone: c.phone,
        totalSpent: 0,
        invoiceCount: 0,
        outstanding: Number(c.current_balance || 0),
      });
    }
    for (const inv of (invoices.data ?? []) as any[]) {
      if (!inv.customer_id) continue;
      const entry = report.get(inv.customer_id);
      if (entry) {
        entry.totalSpent += Number(inv.total);
        entry.invoiceCount += 1;
      }
    }
    const sorted = Array.from(report.values()).sort((a, b) => b.totalSpent - a.totalSpent);
    return sorted;
  }, [customers.data, invoices.data]);

  // Supplier report: purchases and payables
  const supplierReport = useMemo(() => {
    const report = new Map<string, { name: string; phone: string; totalPurchases: number; poCount: number; payable: number }>();
    for (const s of (suppliers.data ?? []) as any[]) {
      report.set(s.id, {
        name: s.name,
        phone: s.phone,
        totalPurchases: 0,
        poCount: 0,
        payable: Number(s.current_balance || 0),
      });
    }
    for (const po of (purchaseOrders.data ?? []) as any[]) {
      if (!po.supplier_id) continue;
      const entry = report.get(po.supplier_id);
      if (entry) {
        entry.totalPurchases += Number(po.total);
        entry.poCount += 1;
      }
    }
    const sorted = Array.from(report.values()).sort((a, b) => b.totalPurchases - a.totalPurchases);
    return sorted;
  }, [suppliers.data, purchaseOrders.data]);

  // Aging report – already in credit module, but we can summarize
  const agingReport = useMemo(() => {
    // Same as in credit module, but we compute globally
    const aging = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    const now = new Date();
    for (const inv of (invoices.data ?? []) as any[]) {
      if (inv.status === "paid" || inv.status === "cancelled") continue;
      if (!inv.is_credit_sale) continue;
      const outstanding = Number(inv.total) - Number(inv.paid_amount || 0);
      if (outstanding <= 0) continue;
      const days = Math.floor((now.getTime() - new Date(inv.created_at).getTime()) / (1000 * 60 * 60 * 24));
      if (days <= 30) aging["0-30"] += outstanding;
      else if (days <= 60) aging["31-60"] += outstanding;
      else if (days <= 90) aging["61-90"] += outstanding;
      else aging["90+"] += outstanding;
    }
    return aging;
  }, [invoices.data]);

  // CSV export function
  const exportCSV = (data: any[], filename: string, headers?: string[]) => {
    if (!data.length) {
      toast.error("No data to export");
      return;
    }
    // If headers not provided, use object keys
    const cols = headers || Object.keys(data[0]);
    const rows = data.map((row) => cols.map((col) => row[col] ?? "").join(","));
    const csv = [cols.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Comprehensive reports with date filters and CSV export."
      />

      {/* Date Filter */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">From</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-36"
          />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-36"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => toast.info("Apply filters")}>
          <Filter className="mr-1 size-3.5" />
          Apply
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              // Export current report data based on tab
              switch (reportTab) {
                case "sales":
                  exportCSV(
                    salesReport.topProducts.map((p) => ({ product: p.name, qty: p.qty, revenue: p.revenue })),
                    "sales_report"
                  );
                  break;
                case "inventory":
                  exportCSV(
                    inventoryReport.map((p) => ({
                      name: p.name,
                      sku: p.sku,
                      totalQty: p.totalQty,
                      totalValue: p.totalValue,
                      reorder_level: p.reorder_level,
                    })),
                    "inventory_report"
                  );
                  break;
                case "profit":
                  toast.info("Exporting profit report - coming soon");
                  break;
                case "customers":
                  exportCSV(customerReport, "customer_report");
                  break;
                case "suppliers":
                  exportCSV(supplierReport, "supplier_report");
                  break;
                case "aging":
                  toast.info("Export aging report - coming soon");
                  break;
                default:
                  toast.info("Export not implemented for this report");
              }
            }}
          >
            <Download className="mr-1 size-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={reportTab} onValueChange={(v) => setReportTab(v as any)}>
        <TabsList className="mb-3 flex flex-wrap">
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="profit">Profit</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="aging">Aging</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <SalesReport data={salesReport} />
        </TabsContent>

        <TabsContent value="inventory">
          <InventoryReport data={inventoryReport} />
        </TabsContent>

        <TabsContent value="profit">
          <ProfitReport data={profitReport} />
        </TabsContent>

        <TabsContent value="customers">
          <CustomerReport data={customerReport} />
        </TabsContent>

        <TabsContent value="suppliers">
          <SupplierReport data={supplierReport} />
        </TabsContent>

        <TabsContent value="aging">
          <AgingReport data={agingReport} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// --- Sub-components for each report ---

function SalesReport({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Revenue</p>
          <p className="text-2xl font-bold">{money(data.totalRevenue)}</p>
        </div>
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Invoices</p>
          <p className="text-2xl font-bold">{data.totalInvoices}</p>
          <p className="text-xs">{data.paidInvoices} paid, {data.creditInvoices} credit</p>
        </div>
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Top Product</p>
          <p className="text-lg font-semibold">{data.topProducts[0]?.name || "—"}</p>
          <p className="text-xs">{money(data.topProducts[0]?.revenue || 0)}</p>
        </div>
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Top Customer</p>
          <p className="text-lg font-semibold">{data.topCustomers[0]?.name || "—"}</p>
          <p className="text-xs">{money(data.topCustomers[0]?.total || 0)}</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="tile p-3">
          <h3 className="font-semibold">Top Products</h3>
          <div className="mt-2 max-h-60 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topProducts.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No sales</TableCell></TableRow>
                ) : (
                  data.topProducts.map((p: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{p.qty}</TableCell>
                      <TableCell>{money(p.revenue)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        <div className="tile p-3">
          <h3 className="font-semibold">Top Customers</h3>
          <div className="mt-2 max-h-60 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Invoices</TableHead>
                  <TableHead>Spend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topCustomers.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No customers</TableCell></TableRow>
                ) : (
                  data.topCustomers.map((c: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{c.name}</TableCell>
                      <TableCell>{c.count}</TableCell>
                      <TableCell>{money(c.total)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}

function InventoryReport({ data }: { data: any[] }) {
  const totalInventoryValue = data.reduce((sum, p) => sum + p.totalValue, 0);
  const lowStockItems = data.filter((p) => p.isLowStock);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Total Inventory Value</p>
          <p className="text-2xl font-bold">{money(totalInventoryValue)}</p>
        </div>
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Low Stock Items</p>
          <p className="text-2xl font-bold text-destructive">{lowStockItems.length}</p>
        </div>
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Total Products</p>
          <p className="text-2xl font-bold">{data.length}</p>
        </div>
      </div>
      <div className="tile p-3">
        <h3 className="font-semibold">All Products</h3>
        <div className="mt-2 max-h-80 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Total Qty</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No products</TableCell></TableRow>
              ) : (
                data.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.sku}</TableCell>
                    <TableCell>{p.totalQty}</TableCell>
                    <TableCell>{money(p.cost_price)}</TableCell>
                    <TableCell>{money(p.totalValue)}</TableCell>
                    <TableCell>
                      {p.isLowStock ? (
                        <Badge variant="destructive">Low Stock</Badge>
                      ) : (
                        <Badge variant="outline">OK</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function ProfitReport({ data }: { data: any }) {
  const profitMargin = data.revenue > 0 ? ((data.grossProfit / data.revenue) * 100).toFixed(1) : 0;
  const netMargin = data.revenue > 0 ? ((data.netProfit / data.revenue) * 100).toFixed(1) : 0;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="tile p-4">
        <h3 className="font-semibold">Profit & Loss Summary</h3>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between border-b pb-1">
            <span>Revenue (Sales)</span>
            <span className="font-semibold text-green-600">{money(data.revenue)}</span>
          </div>
          <div className="flex justify-between border-b pb-1">
            <span>Cost of Goods Sold (COGS)</span>
            <span className="font-semibold text-destructive">- {money(data.cogs)}</span>
          </div>
          <div className="flex justify-between border-b pb-1 font-semibold">
            <span>Gross Profit</span>
            <span className={data.grossProfit >= 0 ? "text-green-600" : "text-destructive"}>
              {money(data.grossProfit)} ({profitMargin}%)
            </span>
          </div>
          <div className="flex justify-between border-b pb-1">
            <span>Operating Expenses</span>
            <span className="font-semibold text-destructive">- {money(data.expenses)}</span>
          </div>
          <div className="flex justify-between pt-1 text-base font-bold">
            <span>Net Profit</span>
            <span className={data.netProfit >= 0 ? "text-green-600" : "text-destructive"}>
              {money(data.netProfit)} ({netMargin}%)
            </span>
          </div>
        </div>
      </div>
      <div className="tile p-4">
        <h3 className="font-semibold">Quick Stats</h3>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Gross Profit Margin</span>
            <span>{profitMargin}%</span>
          </div>
          <div className="flex justify-between">
            <span>Net Profit Margin</span>
            <span>{netMargin}%</span>
          </div>
          <div className="flex justify-between">
            <span>Expense / Revenue Ratio</span>
            <span>{data.revenue > 0 ? ((data.expenses / data.revenue) * 100).toFixed(1) : 0}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomerReport({ data }: { data: any[] }) {
  return (
    <div className="tile p-3">
      <h3 className="font-semibold">Customer Report</h3>
      <div className="mt-2 max-h-80 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Invoices</TableHead>
              <TableHead>Total Spend</TableHead>
              <TableHead>Outstanding</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No customers</TableCell></TableRow>
            ) : (
              data.map((c) => (
                <TableRow key={c.name}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.phone}</TableCell>
                  <TableCell>{c.invoiceCount}</TableCell>
                  <TableCell>{money(c.totalSpent)}</TableCell>
                  <TableCell className={c.outstanding > 0 ? "text-destructive" : ""}>
                    {money(c.outstanding)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SupplierReport({ data }: { data: any[] }) {
  return (
    <div className="tile p-3">
      <h3 className="font-semibold">Supplier Report</h3>
      <div className="mt-2 max-h-80 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Purchase Orders</TableHead>
              <TableHead>Total Purchases</TableHead>
              <TableHead>Payable</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No suppliers</TableCell></TableRow>
            ) : (
              data.map((s) => (
                <TableRow key={s.name}>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.phone}</TableCell>
                  <TableCell>{s.poCount}</TableCell>
                  <TableCell>{money(s.totalPurchases)}</TableCell>
                  <TableCell className={s.payable > 0 ? "text-destructive" : ""}>
                    {money(s.payable)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function AgingReport({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((sum, v) => sum + v, 0);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="tile p-4">
        <h3 className="font-semibold">Aging Summary</h3>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span>0-30 Days</span>
            <span className="text-green-600">{money(data["0-30"])}</span>
          </div>
          <div className="flex justify-between">
            <span>31-60 Days</span>
            <span className="text-yellow-600">{money(data["31-60"])}</span>
          </div>
          <div className="flex justify-between">
            <span>61-90 Days</span>
            <span className="text-orange-600">{money(data["61-90"])}</span>
          </div>
          <div className="flex justify-between">
            <span>90+ Days</span>
            <span className="text-destructive">{money(data["90+"])}</span>
          </div>
          <div className="flex justify-between border-t pt-2 font-bold">
            <span>Total Outstanding</span>
            <span>{money(total)}</span>
          </div>
        </div>
      </div>
      <div className="tile p-4">
        <h3 className="font-semibold">Aging Breakdown</h3>
        <div className="mt-3 space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-green-500" />
            <span className="text-sm">0-30: {money(data["0-30"])}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-yellow-500" />
            <span className="text-sm">31-60: {money(data["31-60"])}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-orange-500" />
            <span className="text-sm">61-90: {money(data["61-90"])}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-red-500" />
            <span className="text-sm">90+: {money(data["90+"])}</span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden flex">
            {total > 0 && (
              <>
                <div
                  className="h-full bg-green-500"
                  style={{ width: `${(data["0-30"] / total) * 100}%` }}
                />
                <div
                  className="h-full bg-yellow-500"
                  style={{ width: `${(data["31-60"] / total) * 100}%` }}
                />
                <div
                  className="h-full bg-orange-500"
                  style={{ width: `${(data["61-90"] / total) * 100}%` }}
                />
                <div
                  className="h-full bg-red-500"
                  style={{ width: `${(data["90+"] / total) * 100}%` }}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
