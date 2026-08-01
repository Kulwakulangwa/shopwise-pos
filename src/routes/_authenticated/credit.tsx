/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  CreditCard,
  DollarSign,
  Users,
  AlertCircle,
  Search,
  Eye,
  ChevronDown,
  ChevronRight,
  Clock,
  Calendar,
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
import { db, useRows } from "@/lib/crud";
import { money, date } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/credit")({
  head: () => ({
    meta: [
      { title: "Credit Management — My Shop" },
      { name: "description", content: "Monitor customer credit limits, outstanding debts, and aging reports." },
    ],
  }),
  component: CreditManagement,
});

type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  credit_limit: number;
  current_balance: number;
  created_at: string;
};

type Invoice = {
  id: string;
  invoice_number: string;
  customer_id: string;
  warehouse_id: string;
  total: number;
  paid_amount: number;
  status: string;
  is_credit_sale: boolean;
  created_at: string;
  due_date?: string;
};

function CreditManagement() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [agingFilter, setAgingFilter] = useState<"all" | "0-30" | "31-60" | "61-90" | "90+">("all");

  // Fetch customers with balances
  const customers = useRows("customers", {
    order: { column: "name", ascending: true },
  });

  // Fetch all invoices (for aging calculation)
  const invoices = useRows("invoices", {
    filters: [["is_credit_sale", true]],
    order: { column: "created_at", ascending: false },
  });

  // Fetch payments (cashbook entries) for customers
  const payments = useRows("cashbook", {
    filters: [["reference_type", "customer_payment"]],
    order: { column: "created_at", ascending: false },
  });

  // Fetch system settings for credit limit action
  const settings = useRows("system_settings");

  const blockOverLimit = useMemo(() => {
    const row = (settings.data ?? []).find((s: any) => s.key === "credit_limit_action");
    return row?.value === "block" || row?.value?.mode === "block";
  }, [settings.data]);

  // Filter customers with outstanding balance
  const customersWithDebt = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = (customers.data ?? [])
      .filter((c: any) => Number(c.current_balance) > 0)
      .map((c: any) => ({
        ...c,
        balance: Number(c.current_balance),
        limit: Number(c.credit_limit),
        isOverLimit: Number(c.credit_limit) > 0 && Number(c.current_balance) > Number(c.credit_limit),
      }));

    if (q) {
      list = list.filter(
        (c: any) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          (c.email && c.email.toLowerCase().includes(q))
      );
    }

    // Sort by balance descending
    list.sort((a: any, b: any) => b.balance - a.balance);
    return list;
  }, [customers.data, search]);

  // Calculate aging for a customer
  const calculateAging = (customerId: string) => {
    const customerInvoices = (invoices.data ?? [])
      .filter((inv: any) => inv.customer_id === customerId && inv.status !== "paid" && inv.status !== "cancelled")
      .map((inv: any) => ({
        ...inv,
        outstanding: inv.total - inv.paid_amount,
        daysAgo: Math.floor((new Date().getTime() - new Date(inv.created_at).getTime()) / (1000 * 60 * 60 * 24)),
      }));

    const aging = {
      "0-30": 0,
      "31-60": 0,
      "61-90": 0,
      "90+": 0,
      total: 0,
    };

    for (const inv of customerInvoices) {
      const days = inv.daysAgo;
      if (days <= 30) aging["0-30"] += inv.outstanding;
      else if (days <= 60) aging["31-60"] += inv.outstanding;
      else if (days <= 90) aging["61-90"] += inv.outstanding;
      else aging["90+"] += inv.outstanding;
      aging.total += inv.outstanding;
    }

    return aging;
  };

  // Get all customers with aging data for the aging report
  const agingReport = useMemo(() => {
    const report: any[] = [];
    for (const c of (customers.data ?? [])) {
      const balance = Number(c.current_balance);
      if (balance <= 0) continue;
      const aging = calculateAging(c.id);
      report.push({
        customer: c,
        aging,
        balance,
        limit: Number(c.credit_limit),
        isOverLimit: Number(c.credit_limit) > 0 && balance > Number(c.credit_limit),
      });
    }
    // Sort by aging total
    report.sort((a, b) => b.aging.total - a.aging.total);
    return report;
  }, [customers.data, invoices.data]);

  // Filter aging report by aging bucket
  const filteredAgingReport = useMemo(() => {
    if (agingFilter === "all") return agingReport;
    return agingReport.filter((item) => item.aging[agingFilter] > 0);
  }, [agingReport, agingFilter]);

  // Totals for summary
  const totalOutstanding = useMemo(() => {
    return (customers.data ?? []).reduce((sum: number, c: any) => sum + Number(c.current_balance), 0);
  }, [customers.data]);

  const totalOverLimit = useMemo(() => {
    return (customers.data ?? []).filter(
      (c: any) => Number(c.credit_limit) > 0 && Number(c.current_balance) > Number(c.credit_limit)
    ).length;
  }, [customers.data]);

  const agingTotals = useMemo(() => {
    const totals = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    for (const item of agingReport) {
      totals["0-30"] += item.aging["0-30"];
      totals["31-60"] += item.aging["31-60"];
      totals["61-90"] += item.aging["61-90"];
      totals["90+"] += item.aging["90+"];
    }
    return totals;
  }, [agingReport]);

  const openCustomerDetail = (customer: Customer) => {
    setSelectedCustomer(customer);
    setDetailOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Credit Management"
        subtitle="Monitor customer credit limits, outstanding debts, and aging reports."
      />

      {/* Summary Cards */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Total Outstanding</p>
          <p className="text-2xl font-bold text-destructive">{money(totalOutstanding)}</p>
        </div>
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Customers with Debt</p>
          <p className="text-2xl font-bold">{customersWithDebt.length}</p>
        </div>
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Over Limit</p>
          <p className="text-2xl font-bold text-amber-600">{totalOverLimit}</p>
          <p className="text-xs text-muted-foreground">
            {blockOverLimit ? "🔒 Blocked" : "⚠️ Warn only"}
          </p>
        </div>
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Average Debt</p>
          <p className="text-2xl font-bold">
            {money(
              totalOutstanding / (customersWithDebt.length || 1)
            )}
          </p>
        </div>
      </div>

      {/* Aging Summary */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="tile p-2 text-center">
          <p className="text-xs uppercase text-muted-foreground">0-30 Days</p>
          <p className="text-lg font-semibold text-green-600">{money(agingTotals["0-30"])}</p>
        </div>
        <div className="tile p-2 text-center">
          <p className="text-xs uppercase text-muted-foreground">31-60 Days</p>
          <p className="text-lg font-semibold text-yellow-600">{money(agingTotals["31-60"])}</p>
        </div>
        <div className="tile p-2 text-center">
          <p className="text-xs uppercase text-muted-foreground">61-90 Days</p>
          <p className="text-lg font-semibold text-orange-600">{money(agingTotals["61-90"])}</p>
        </div>
        <div className="tile p-2 text-center">
          <p className="text-xs uppercase text-muted-foreground">90+ Days</p>
          <p className="text-lg font-semibold text-destructive">{money(agingTotals["90+"])}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="debtors" className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="debtors">Debtors</TabsTrigger>
            <TabsTrigger value="aging">Aging Report</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-40">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-7"
                placeholder="Search customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                size={30}
              />
            </div>
            <Button size="sm" variant="outline" onClick={() => toast.info("Export report - coming soon")}>
              Export
            </Button>
          </div>
        </div>

        <TabsContent value="debtors" className="mt-3">
          <DebtorsTable
            customers={customersWithDebt}
            onView={openCustomerDetail}
            blockOverLimit={blockOverLimit}
          />
        </TabsContent>

        <TabsContent value="aging" className="mt-3">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <Label>Aging Bucket:</Label>
            <Select
              value={agingFilter}
              onValueChange={(v) => setAgingFilter(v as any)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="0-30">0-30 Days</SelectItem>
                <SelectItem value="31-60">31-60 Days</SelectItem>
                <SelectItem value="61-90">61-90 Days</SelectItem>
                <SelectItem value="90+">90+ Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AgingTable
            report={filteredAgingReport}
            onView={openCustomerDetail}
            blockOverLimit={blockOverLimit}
          />
        </TabsContent>
      </Tabs>

      {/* Customer Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedCustomer?.name}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {selectedCustomer?.phone}
              </span>
            </DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Credit Limit</p>
                  <p className="font-semibold">{money(selectedCustomer.credit_limit)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Current Balance</p>
                  <p className={`font-semibold ${selectedCustomer.current_balance > 0 ? "text-destructive" : ""}`}>
                    {money(selectedCustomer.current_balance)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  {Number(selectedCustomer.credit_limit) > 0 && Number(selectedCustomer.current_balance) > Number(selectedCustomer.credit_limit) ? (
                    <Badge variant="destructive">Over Limit</Badge>
                  ) : selectedCustomer.current_balance > 0 ? (
                    <Badge variant="outline" className="text-amber-600">Has Debt</Badge>
                  ) : (
                    <Badge variant="outline" className="text-green-600">Clear</Badge>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Member Since</p>
                  <p>{date(selectedCustomer.created_at)}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Aging Breakdown</p>
                <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                  <div className="rounded-md border p-2">
                    <p className="text-xs text-muted-foreground">0-30</p>
                    <p className="font-semibold text-green-600">
                      {money(calculateAging(selectedCustomer.id)["0-30"])}
                    </p>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="text-xs text-muted-foreground">31-60</p>
                    <p className="font-semibold text-yellow-600">
                      {money(calculateAging(selectedCustomer.id)["31-60"])}
                    </p>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="text-xs text-muted-foreground">61-90</p>
                    <p className="font-semibold text-orange-600">
                      {money(calculateAging(selectedCustomer.id)["61-90"])}
                    </p>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="text-xs text-muted-foreground">90+</p>
                    <p className="font-semibold text-destructive">
                      {money(calculateAging(selectedCustomer.id)["90+"])}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Recent Invoices</p>
                <div className="max-h-48 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(invoices.data ?? [])
                        .filter((inv: any) => inv.customer_id === selectedCustomer.id)
                        .slice(0, 10)
                        .map((inv: any) => {
                          const balance = inv.total - inv.paid_amount;
                          return (
                            <TableRow key={inv.id}>
                              <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                              <TableCell>{date(inv.created_at)}</TableCell>
                              <TableCell>{money(inv.total)}</TableCell>
                              <TableCell>{money(inv.paid_amount)}</TableCell>
                              <TableCell className={balance > 0 ? "text-destructive" : ""}>
                                {money(balance)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize">
                                  {inv.status.replace("_", " ")}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      {(!invoices.data || (invoices.data ?? []).filter((inv: any) => inv.customer_id === selectedCustomer.id).length === 0) && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            No invoices
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Debtors Table
function DebtorsTable({ customers, onView, blockOverLimit }: any) {
  if (!customers.length) {
    return <div className="py-8 text-center text-muted-foreground">No customers with outstanding debt.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Credit Limit</TableHead>
            <TableHead>Balance</TableHead>
            <TableHead>Utilization</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((c: any) => {
            const utilization = c.limit > 0 ? (c.balance / c.limit) * 100 : 0;
            const isOverLimit = c.isOverLimit;
            return (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.phone}</TableCell>
                <TableCell>{money(c.limit)}</TableCell>
                <TableCell className="text-destructive">{money(c.balance)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full ${isOverLimit ? "bg-destructive" : utilization > 70 ? "bg-amber-500" : "bg-green-500"}`}
                        style={{ width: `${Math.min(utilization, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs">{Math.round(utilization)}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  {isOverLimit ? (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <AlertCircle className="size-3" />
                      {blockOverLimit ? "Blocked" : "Warning"}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600">Active</Badge>
                  )}
                </TableCell>
                <TableCell className="flex justify-end">
                  <Button variant="ghost" size="icon" onClick={() => onView(c)}>
                    <Eye className="size-4" />
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

// Aging Table
function AgingTable({ report, onView, blockOverLimit }: any) {
  if (!report.length) {
    return <div className="py-8 text-center text-muted-foreground">No aging data found.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>0-30</TableHead>
            <TableHead>31-60</TableHead>
            <TableHead>61-90</TableHead>
            <TableHead>90+</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {report.map((item: any) => {
            const isOverLimit = item.isOverLimit;
            return (
              <TableRow key={item.customer.id}>
                <TableCell className="font-medium">{item.customer.name}</TableCell>
                <TableCell className={item.aging["0-30"] > 0 ? "text-green-600" : "text-muted-foreground"}>
                  {money(item.aging["0-30"])}
                </TableCell>
                <TableCell className={item.aging["31-60"] > 0 ? "text-yellow-600" : "text-muted-foreground"}>
                  {money(item.aging["31-60"])}
                </TableCell>
                <TableCell className={item.aging["61-90"] > 0 ? "text-orange-600" : "text-muted-foreground"}>
                  {money(item.aging["61-90"])}
                </TableCell>
                <TableCell className={item.aging["90+"] > 0 ? "text-destructive" : "text-muted-foreground"}>
                  {money(item.aging["90+"])}
                </TableCell>
                <TableCell className="font-semibold text-destructive">
                  {money(item.aging.total)}
                </TableCell>
                <TableCell>
                  {isOverLimit ? (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <AlertCircle className="size-3" />
                      {blockOverLimit ? "Blocked" : "Warning"}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Active</Badge>
                  )}
                </TableCell>
                <TableCell className="flex justify-end">
                  <Button variant="ghost" size="icon" onClick={() => onView(item.customer)}>
                    <Eye className="size-4" />
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
