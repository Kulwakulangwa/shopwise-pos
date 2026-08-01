/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  Banknote,
  Calendar,
  Search,
  Plus,
  Eye,
  ArrowUp,
  ArrowDown,
  FileText,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { db, useRows, currentUserId } from "@/lib/crud";
import { money, date, time } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({
    meta: [
      { title: "Finance — My Shop" },
      { name: "description", content: "Cashbook, income/expenses, profit & loss, and bank accounts." },
    ],
  }),
  component: Finance,
});

type CashEntry = {
  id: string;
  direction: "in" | "out";
  amount: number;
  description: string;
  reference_type: string;
  reference_id?: string;
  bank_account_id?: string;
  created_at: string;
  created_by: string;
};

function Finance() {
  const qc = useQueryClient();
  const [dateFrom, setDateFrom] = useState(
    new Date(new Date().setDate(1)).toISOString().slice(0, 10)
  );
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [filterType, setFilterType] = useState<"all" | "in" | "out">("all");
  const [search, setSearch] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<CashEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<CashEntry>>({
    direction: "in",
    amount: 0,
    description: "",
    reference_type: "manual",
    bank_account_id: "",
  });
  const [processing, setProcessing] = useState(false);

  // Fetch data
  const cashbook = useRows("cash_transactions", {
    order: { column: "occurred_at", ascending: false },
  });
  const bankAccounts = useRows("bank_accounts", {
    order: { column: "name", ascending: true },
  });
  const invoices = useRows("invoices", {
    filters: [["status", "!=", "cancelled"]],
  });
  const invoiceItems = useRows("invoice_items");

  // Date filtering for cashbook
  const filteredCashbook = useMemo(() => {
    let entries = (cashbook.data ?? []) as CashEntry[];
    if (dateFrom) {
      entries = entries.filter((e) => e.created_at >= dateFrom);
    }
    if (dateTo) {
      entries = entries.filter((e) => e.created_at <= dateTo + "T23:59:59");
    }
    if (filterType !== "all") {
      entries = entries.filter((e) => e.direction === filterType);
    }
    if (search) {
      const q = search.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.description.toLowerCase().includes(q) ||
          e.reference_type.toLowerCase().includes(q) ||
          (e.reference_id && e.reference_id.toLowerCase().includes(q))
      );
    }
    return entries;
  }, [cashbook.data, dateFrom, dateTo, filterType, search]);

  // Compute totals
  const totalIn = useMemo(() => {
    return filteredCashbook
      .filter((e) => e.direction === "in")
      .reduce((sum, e) => sum + Number(e.amount), 0);
  }, [filteredCashbook]);

  const totalOut = useMemo(() => {
    return filteredCashbook
      .filter((e) => e.direction === "out")
      .reduce((sum, e) => sum + Number(e.amount), 0);
  }, [filteredCashbook]);

  const netCash = totalIn - totalOut;

  // Revenue from invoices
  const totalRevenue = useMemo(() => {
    return (invoices.data ?? [])
      .reduce((sum: number, inv: any) => sum + Number(inv.total), 0);
  }, [invoices.data]);

  // COGS from invoice_items
  const totalCOGS = useMemo(() => {
    return (invoiceItems.data ?? [])
      .reduce((sum: number, item: any) => sum + Number(item.cost_price) * Number(item.quantity), 0);
  }, [invoiceItems.data]);

  const grossProfit = totalRevenue - totalCOGS;
  const netProfit = grossProfit - totalOut; // simplified

  // Bank balances
  const totalBankBalance = useMemo(() => {
    return (bankAccounts.data ?? []).reduce((sum: number, acc: any) => sum + Number(acc.current_balance), 0);
  }, [bankAccounts.data]);

  // Handlers
  const viewEntry = (entry: CashEntry) => {
    setSelectedEntry(entry);
    setDetailOpen(true);
  };

  const addEntry = async () => {
    if (!formData.amount || formData.amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!formData.description) {
      toast.error("Description is required");
      return;
    }
    setProcessing(true);
    try {
      const userId = await currentUserId();
      const entry = {
        direction: formData.direction,
        amount: Number(formData.amount),
        description: formData.description,
        reference_type: formData.reference_type || "manual",
        reference_id: formData.reference_id || null,
        bank_account_id: formData.bank_account_id || null,
        created_by: userId,
        occurred_at: new Date().toISOString(),
      };
      await db.from("cash_transactions").insert(entry);
      toast.success("Cash entry added");
      setFormOpen(false);
      setFormData({ direction: "in", amount: 0, description: "", reference_type: "manual" });
      void qc.invalidateQueries({ queryKey: ["cash_transactions", "bank_accounts"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Add entry failed");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Finance"
        subtitle="Cashbook, income/expenses, profit & loss, and bank accounts."
      />

      {/* Summary Cards */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Total Revenue</p>
          <p className="text-2xl font-bold text-green-600">{money(totalRevenue)}</p>
        </div>
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Total Expenses</p>
          <p className="text-2xl font-bold text-destructive">{money(totalOut)}</p>
        </div>
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Gross Profit</p>
          <p className={`text-2xl font-bold ${grossProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
            {money(grossProfit)}
          </p>
        </div>
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Net Profit</p>
          <p className={`text-2xl font-bold ${netProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
            {money(netProfit)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="cashbook" className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="cashbook">Cashbook</TabsTrigger>
            <TabsTrigger value="pnl">Profit & Loss</TabsTrigger>
            <TabsTrigger value="accounts">Bank Accounts</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="mr-1 size-3.5" />
              Add Entry
            </Button>
            <Button size="sm" variant="outline" onClick={() => toast.info("Export - coming soon")}>
              Export
            </Button>
          </div>
        </div>

        <TabsContent value="cashbook" className="mt-3">
          {/* Filters */}
          <div className="mb-3 flex flex-wrap items-end gap-3">
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
            <div>
              <Label className="text-xs">Direction</Label>
              <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="in">In</SelectItem>
                  <SelectItem value="out">Out</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                className="pl-7 w-40"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="ml-auto flex gap-3 text-sm">
              <span>In: <span className="font-semibold text-green-600">{money(totalIn)}</span></span>
              <span>Out: <span className="font-semibold text-destructive">{money(totalOut)}</span></span>
              <span>Net: <span className={`font-semibold ${netCash >= 0 ? "text-green-600" : "text-destructive"}`}>{money(netCash)}</span></span>
            </div>
          </div>

          {/* Cashbook Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">In</TableHead>
                  <TableHead className="text-right">Out</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCashbook.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No cash entries found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCashbook.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{date(entry.created_at)}</TableCell>
                      <TableCell>{entry.description}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline">{entry.reference_type}</Badge>
                        {entry.reference_id && (
                          <span className="ml-1 font-mono text-xs">{entry.reference_id.slice(0, 8)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.direction === "in" ? money(entry.amount) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.direction === "out" ? money(entry.amount) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => viewEntry(entry)}>
                          <Eye className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="pnl" className="mt-3">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="tile p-4">
              <h3 className="font-semibold">Profit & Loss Statement</h3>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between border-b pb-1">
                  <span>Revenue (Sales)</span>
                  <span className="font-semibold text-green-600">{money(totalRevenue)}</span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span>Cost of Goods Sold (COGS)</span>
                  <span className="font-semibold text-destructive">- {money(totalCOGS)}</span>
                </div>
                <div className="flex justify-between border-b pb-1 font-semibold">
                  <span>Gross Profit</span>
                  <span className={grossProfit >= 0 ? "text-green-600" : "text-destructive"}>
                    {money(grossProfit)}
                  </span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span>Operating Expenses</span>
                  <span className="font-semibold text-destructive">- {money(totalOut)}</span>
                </div>
                <div className="flex justify-between pt-1 text-base font-bold">
                  <span>Net Profit</span>
                  <span className={netProfit >= 0 ? "text-green-600" : "text-destructive"}>
                    {money(netProfit)}
                  </span>
                </div>
              </div>
            </div>

            <div className="tile p-4">
              <h3 className="font-semibold">Summary</h3>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total Inflows (Cash in)</span>
                  <span className="text-green-600">{money(totalIn)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Outflows (Cash out)</span>
                  <span className="text-destructive">{money(totalOut)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>Net Cash Flow</span>
                  <span className={netCash >= 0 ? "text-green-600" : "text-destructive"}>
                    {money(netCash)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Bank Balance (total)</span>
                  <span>{money(totalBankBalance)}</span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="accounts" className="mt-3">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium">Bank Accounts</h3>
            <Button size="sm" variant="outline" onClick={() => toast.info("Add account - coming soon")}>
              <Plus className="mr-1 size-3.5" />
              Add Account
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Account Number</TableHead>
                  <TableHead>Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(bankAccounts.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No bank accounts set up.
                    </TableCell>
                  </TableRow>
                ) : (
                  (bankAccounts.data ?? []).map((acc: any) => (
                    <TableRow key={acc.id}>
                      <TableCell className="font-medium">{acc.name}</TableCell>
                      <TableCell>{acc.bank_name || "—"}</TableCell>
                      <TableCell>{acc.account_number || "—"}</TableCell>
                      <TableCell className="font-semibold">{money(acc.current_balance)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Entry Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cash Entry Detail</DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p>{date(selectedEntry.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Direction</p>
                  <Badge variant={selectedEntry.direction === "in" ? "default" : "destructive"}>
                    {selectedEntry.direction.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="font-semibold">{money(selectedEntry.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Reference Type</p>
                  <p>{selectedEntry.reference_type}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Description</p>
                  <p>{selectedEntry.description}</p>
                </div>
                {selectedEntry.reference_id && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Reference ID</p>
                    <p className="font-mono text-xs">{selectedEntry.reference_id}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Cash Entry Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Cash Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Direction</Label>
              <Select
                value={formData.direction}
                onValueChange={(v) => setFormData({ ...formData, direction: v as "in" | "out" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">In</SelectItem>
                  <SelectItem value="out">Out</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (TZS)</Label>
              <Input
                type="number"
                value={formData.amount || ""}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g., Office supplies"
              />
            </div>
            <div>
              <Label>Reference Type</Label>
              <Input
                value={formData.reference_type || ""}
                onChange={(e) => setFormData({ ...formData, reference_type: e.target.value })}
                placeholder="e.g., manual, supplier_payment"
              />
            </div>
            <div>
              <Label>Reference ID (optional)</Label>
              <Input
                value={formData.reference_id || ""}
                onChange={(e) => setFormData({ ...formData, reference_id: e.target.value })}
                placeholder="e.g., invoice ID"
              />
            </div>
            <div>
              <Label>Bank Account (optional)</Label>
              <Select
                value={formData.bank_account_id || ""}
                onValueChange={(v) => setFormData({ ...formData, bank_account_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {(bankAccounts.data ?? []).map((acc: any) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button onClick={addEntry} disabled={processing}>
                {processing ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
