/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Eye,
  FileText,
  Filter,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  currentUserId,
  db,
  applyStockMovement,
  recordCash,
  useRows,
  docNumber,
} from "@/lib/crud";
import { money, num, date } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({
    meta: [
      { title: "Sales Management — My Shop" },
      { name: "description", content: "Manage invoices, quotations, orders, and returns." },
    ],
  }),
  component: SalesManagement,
});

type Invoice = {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  warehouse_id: string;
  status: "draft" | "sent" | "paid" | "partially_paid" | "unpaid" | "cancelled" | "returned";
  is_credit_sale: boolean;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid_amount: number;
  payment_method: string | null;
  created_at: string;
  created_by: string;
  customers?: { name: string; phone: string } | null;
  invoice_items?: any[];
};

function SalesManagement() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"invoices" | "quotations" | "orders" | "returns">("invoices");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnItems, setReturnItems] = useState<Record<string, number>>({});
  const [returnRestock, setReturnRestock] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Fetch data
  const invoices = useRows("invoices", {
    select: "*, customers(name, phone)",
    order: { column: "created_at", ascending: false },
  });
  const invoiceItems = useRows("invoice_items", {
    filters: selectedInvoice ? [["invoice_id", selectedInvoice.id]] : [],
  });
  const products = useRows("products", { select: "id, name, sku, tracks_serial" });
  const stock = useRows("stock_levels"); // for restock validation
  const warehouses = useRows("warehouses");
  const customers = useRows("customers");

  // Filter invoices based on tab, search, status, date
  const filteredInvoices = useMemo(() => {
    let list = (invoices.data ?? []) as Invoice[];

    // Tab filtering (simulate with statuses)
    if (tab === "invoices") {
      list = list.filter((inv) => !["draft", "sent"].includes(inv.status));
    } else if (tab === "quotations") {
      list = list.filter((inv) => inv.status === "draft" || inv.status === "sent");
    } else if (tab === "orders") {
      // In this demo, we treat "orders" as invoices with status "sent" or "partially_paid"? 
      // Usually sales orders are separate, but here we reuse invoices for simplicity.
      // We'll mark them as "order" status if needed, but we don't have that status.
      // For now, we'll just show all non‑draft/non‑cancelled.
      list = list.filter((inv) => !["draft", "cancelled", "returned"].includes(inv.status));
    } else if (tab === "returns") {
      list = list.filter((inv) => inv.status === "returned");
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (inv) =>
          inv.invoice_number.toLowerCase().includes(q) ||
          inv.customers?.name?.toLowerCase().includes(q) ||
          inv.customers?.phone?.includes(q),
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((inv) => inv.status === statusFilter);
    }
    if (dateFrom) {
      list = list.filter((inv) => inv.created_at >= dateFrom);
    }
    if (dateTo) {
      list = list.filter((inv) => inv.created_at <= dateTo);
    }
    return list;
  }, [invoices.data, tab, search, statusFilter, dateFrom, dateTo]);

  const totalBalance = useMemo(() => {
    // For credit sales with outstanding balance
    return filteredInvoices
      .filter((inv) => inv.is_credit_sale && inv.status !== "paid" && inv.status !== "cancelled")
      .reduce((sum, inv) => sum + (inv.total - inv.paid_amount), 0);
  }, [filteredInvoices]);

  // Handlers
  const viewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setDetailOpen(true);
  };

  const handleReturn = async () => {
    if (!selectedInvoice) return;
    const items = selectedInvoice.invoice_items || [];
    const toReturn = Object.keys(returnItems).filter((id) => returnItems[id] > 0);
    if (toReturn.length === 0) {
      toast.error("Select at least one item to return");
      return;
    }
    setProcessing(true);
    try {
      const userId = await currentUserId();
      // Create a return record – we'll just update the invoice status and create a credit note
      // For simplicity, we'll set invoice status to "returned" and create a stock movement "in"
      // for each returned quantity.
      for (const itemId of toReturn) {
        const qty = returnItems[itemId];
        const item = items.find((i) => i.id === itemId);
        if (!item) continue;
        // Restock if enabled
        if (returnRestock) {
          await applyStockMovement({
            productId: item.product_id,
            warehouseId: selectedInvoice.warehouse_id,
            type: "in",
            quantity: qty,
            referenceType: "return",
            referenceId: selectedInvoice.id,
            note: `Return from invoice ${selectedInvoice.invoice_number}`,
          });
          // If serials were used, we should mark them back to in_stock? 
          // That's more complex – we assume serials are handled separately.
        }
        // Reverse warranty? Not required per spec.
      }

      // Update invoice status and reduce paid amount? We'll just mark as returned.
      await db
        .from("invoices")
        .update({ status: "returned" })
        .eq("id", selectedInvoice.id);

      // Optionally create a credit note / negative invoice? Not in spec.

      toast.success("Return processed successfully");
      setReturnDialogOpen(false);
      setSelectedInvoice(null);
      setReturnItems({});
      // Invalidate queries
      for (const key of ["invoices", "stock_levels", "stock_movements", "dashboard"]) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Return failed");
    } finally {
      setProcessing(false);
    }
  };

  const openReturnDialog = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    // Fetch items for this invoice if not already loaded
    setReturnItems(
      (invoice.invoice_items || []).reduce((acc, item) => ({ ...acc, [item.id]: 0 }), {}),
    );
    setReturnRestock(true);
    setReturnDialogOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Sales Management"
        subtitle="Manage invoices, quotations, orders, and returns. Credit sales and debt tracking included."
      />

      {/* Summary Cards */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Total Invoices</p>
          <p className="text-2xl font-bold">{filteredInvoices.length}</p>
        </div>
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Total Revenue</p>
          <p className="text-2xl font-bold">
            {money(filteredInvoices.reduce((sum, inv) => sum + inv.total, 0))}
          </p>
        </div>
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Outstanding Debt</p>
          <p className="text-2xl font-bold text-destructive">{money(totalBalance)}</p>
        </div>
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Returns</p>
          <p className="text-2xl font-bold">
            {filteredInvoices.filter((inv) => inv.status === "returned").length}
          </p>
        </div>
      </div>

      {/* Tabs and Filters */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="quotations">Quotations</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="returns">Returns</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-40">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-7"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                size={30}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="partially_paid">Partially Paid</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              className="w-32"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <Input
              type="date"
              className="w-32"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setDateFrom("");
                setDateTo("");
              }}
            >
              <X className="size-4" />
            </Button>
            <Button size="sm" onClick={() => toast.info("Export CSV - coming soon")}>
              <Download className="mr-1 size-3.5" />
              Export
            </Button>
          </div>
        </div>

        <TabsContent value="invoices" className="mt-3">
          <InvoiceTable
            invoices={filteredInvoices}
            onView={viewInvoice}
            onReturn={openReturnDialog}
          />
        </TabsContent>
        <TabsContent value="quotations" className="mt-3">
          <InvoiceTable
            invoices={filteredInvoices}
            onView={viewInvoice}
            onReturn={openReturnDialog}
          />
        </TabsContent>
        <TabsContent value="orders" className="mt-3">
          <InvoiceTable
            invoices={filteredInvoices}
            onView={viewInvoice}
            onReturn={openReturnDialog}
          />
        </TabsContent>
        <TabsContent value="returns" className="mt-3">
          <InvoiceTable
            invoices={filteredInvoices}
            onView={viewInvoice}
            onReturn={openReturnDialog}
          />
        </TabsContent>
      </Tabs>

      {/* Invoice Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Invoice {selectedInvoice?.invoice_number}
              <Badge className="ml-2" variant="outline">
                {selectedInvoice?.status}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p>{selectedInvoice.customers?.name || "Walk-in"}</p>
                  <p className="text-xs">{selectedInvoice.customers?.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p>{date(selectedInvoice.created_at)}</p>
                  <p className="text-xs">Warehouse: {warehouses.data?.find((w: any) => w.id === selectedInvoice.warehouse_id)?.name}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Items</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selectedInvoice.invoice_items || []).map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>{products.data?.find((p: any) => p.id === item.product_id)?.name || item.product_id}</TableCell>
                        <TableCell>{num(item.quantity)}</TableCell>
                        <TableCell>{money(item.unit_price)}</TableCell>
                        <TableCell>{money(item.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end space-x-4 border-t pt-2">
                <div>
                  <p className="text-xs text-muted-foreground">Subtotal</p>
                  <p>{money(selectedInvoice.subtotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Discount</p>
                  <p>{money(selectedInvoice.discount)}</p>
                </div>
                <div className="font-semibold">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p>{money(selectedInvoice.total)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Paid</p>
                  <p>{money(selectedInvoice.paid_amount)}</p>
                </div>
                {selectedInvoice.is_credit_sale && (
                  <div className="text-destructive">
                    <p className="text-xs text-muted-foreground">Balance</p>
                    <p>{money(selectedInvoice.total - selectedInvoice.paid_amount)}</p>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm">
                  <Printer className="mr-1 size-3.5" />
                  Print
                </Button>
                <Button variant="outline" size="sm">
                  <FileText className="mr-1 size-3.5" />
                  PDF
                </Button>
                {selectedInvoice.status !== "returned" && selectedInvoice.status !== "cancelled" && (
                  <Button variant="destructive" size="sm" onClick={() => openReturnDialog(selectedInvoice)}>
                    <RotateCcw className="mr-1 size-3.5" />
                    Return
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Return for {selectedInvoice?.invoice_number}</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="space-y-2">
                {selectedInvoice.invoice_items?.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <span className="text-sm">
                      {products.data?.find((p: any) => p.id === item.product_id)?.name || item.product_id}
                      {' '}({num(item.quantity)})
                    </span>
                    <Input
                      type="number"
                      className="w-20"
                      min={0}
                      max={item.quantity}
                      value={returnItems[item.id] || 0}
                      onChange={(e) =>
                        setReturnItems((prev) => ({
                          ...prev,
                          [item.id]: Math.min(Number(e.target.value), item.quantity),
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="restock"
                  checked={returnRestock}
                  onChange={(e) => setReturnRestock(e.target.checked)}
                />
                <Label htmlFor="restock">Restock returned items</Label>
              </div>
              <Button
                onClick={handleReturn}
                disabled={processing}
                className="w-full"
              >
                {processing ? "Processing..." : "Confirm Return"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Table component
function InvoiceTable({
  invoices,
  onView,
  onReturn,
}: {
  invoices: Invoice[];
  onView: (invoice: Invoice) => void;
  onReturn: (invoice: Invoice) => void;
}) {
  if (!invoices.length) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        No invoices found.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Paid</TableHead>
            <TableHead>Balance</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv) => {
            const balance = inv.total - inv.paid_amount;
            const isCredit = inv.is_credit_sale;
            return (
              <TableRow key={inv.id}>
                <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                <TableCell>{inv.customers?.name || "Walk-in"}</TableCell>
                <TableCell className="text-xs">{date(inv.created_at)}</TableCell>
                <TableCell className="font-semibold">{money(inv.total)}</TableCell>
                <TableCell>{money(inv.paid_amount)}</TableCell>
                <TableCell className={balance > 0 ? "text-destructive" : ""}>
                  {isCredit ? money(balance) : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {inv.status.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onView(inv)}>
                    <Eye className="size-4" />
                  </Button>
                  {inv.status !== "returned" && inv.status !== "cancelled" && (
                    <Button variant="ghost" size="icon" onClick={() => onReturn(inv)}>
                      <RotateCcw className="size-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => toast.info("Print preview")}>
                    <Printer className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
