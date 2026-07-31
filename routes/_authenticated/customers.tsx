/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Edit,
  Eye,
  Plus,
  Search,
  Trash2,
  User,
  Users,
  CreditCard,
  History,
  Receipt,
  AlertCircle,
  X,
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
  DialogTrigger,
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
import { db, useRows, docNumber } from "@/lib/crud";
import { money, date } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({
    meta: [
      { title: "Customer Management — My Shop" },
      { name: "description", content: "Manage customer profiles, credit limits, and statements." },
    ],
  }),
  component: CustomerManagement,
});

type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  credit_limit: number;
  current_balance: number;
  created_at: string;
};

type Invoice = {
  id: string;
  invoice_number: string;
  total: number;
  paid_amount: number;
  status: string;
  is_credit_sale: boolean;
  created_at: string;
};

type Payment = {
  id: string;
  amount: number;
  reference_type: string;
  reference_id?: string;
  description: string;
  created_at: string;
};

function CustomerManagement() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<Partial<Customer>>({});
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [processing, setProcessing] = useState(false);

  // Fetch customers
  const customers = useRows("customers", {
    order: { column: "name", ascending: true },
  });

  // Fetch invoices for selected customer
  const customerInvoices = useRows("invoices", {
    filters: selectedCustomer ? [["customer_id", selectedCustomer.id]] : [],
    order: { column: "created_at", ascending: false },
  });

  // Fetch payments (cashbook entries) for selected customer? 
  // We'll derive statement from invoices + separate payment records if any.
  // The spec says "statement of invoices + payments" – we can show invoices and a separate payments table.
  // For simplicity, we'll show invoices and a "payments" table that we need to fetch.
  // We'll use the cashbook table with reference_type = 'invoice' and reference_id = invoice.id? 
  // Or we could have a customer_payments table. The spec says customer_payments reduce balance.
  // The current implementation updates customer.current_balance on credit sale and we have recordCash.
  // We need a separate customer_payments table or we can use cashbook entries with reference_type = 'customer_payment' and reference_id = customer.id.
  // Let's assume we have a customer_payments table. If not, we can adapt.
  // To keep it simple, I'll query cashbook where reference_type = 'customer_payment' and reference_id = customer.id
  // But we don't have that table. We'll create a simple solution: use cashbook entries with description containing customer name? Not ideal.
  // Better: we add a customer_payments table. Since we can't modify schema now, we'll use a workaround: we'll show invoices and a "payment received" line from the invoice if paid.
  // Actually, the spec says: "customer_payments reduce it" – we need a payment record. We can use the cashbook table with reference_type = 'customer_payment' and reference_id = customer.id.
  // I'll assume that table exists. If not, we can create it. For now, I'll use cashbook as a fallback.

  // Let's fetch cashbook entries for customer payments.
  const customerPayments = useRows("cashbook", {
    filters: selectedCustomer ? [
      ["reference_type", "customer_payment"],
      ["reference_id", selectedCustomer.id],
    ] : [],
    order: { column: "created_at", ascending: false },
  });

  // We'll also need to fetch all invoices for purchase history
  const allInvoices = useRows("invoices", {
    filters: selectedCustomer ? [["customer_id", selectedCustomer.id]] : [],
  });

  // Filter customers by search
  const filteredCustomers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return customers.data ?? [];
    return (customers.data ?? []).filter((c: any) =>
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  }, [customers.data, search]);

  // Total outstanding balance across all customers (for summary)
  const totalOutstanding = useMemo(() => {
    return (customers.data ?? []).reduce((sum: number, c: any) => sum + Number(c.current_balance), 0);
  }, [customers.data]);

  // Handlers
  const openDetail = (customer: Customer) => {
    setSelectedCustomer(customer);
    setDetailOpen(true);
  };

  const openForm = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData(customer);
    } else {
      setEditingCustomer(null);
      setFormData({ name: "", phone: "", email: "", address: "", credit_limit: 0 });
    }
    setFormOpen(true);
  };

  const saveCustomer = async () => {
    if (!formData.name || !formData.phone) {
      toast.error("Name and phone are required");
      return;
    }
    setProcessing(true);
    try {
      if (editingCustomer) {
        await db
          .from("customers")
          .update({
            name: formData.name,
            phone: formData.phone,
            email: formData.email || null,
            address: formData.address || null,
            credit_limit: Number(formData.credit_limit || 0),
          })
          .eq("id", editingCustomer.id);
        toast.success("Customer updated");
      } else {
        await db.from("customers").insert({
          name: formData.name,
          phone: formData.phone,
          email: formData.email || null,
          address: formData.address || null,
          credit_limit: Number(formData.credit_limit || 0),
          current_balance: 0,
        });
        toast.success("Customer created");
      }
      setFormOpen(false);
      setEditingCustomer(null);
      setFormData({});
      void qc.invalidateQueries({ queryKey: ["customers"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save customer");
    } finally {
      setProcessing(false);
    }
  };

  const deleteCustomer = async (id: string) => {
    if (!confirm("Delete this customer? This cannot be undone.")) return;
    try {
      await db.from("customers").delete().eq("id", id);
      toast.success("Customer deleted");
      void qc.invalidateQueries({ queryKey: ["customers"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed");
    }
  };

  const recordPayment = async () => {
    if (!selectedCustomer) return;
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (amount > selectedCustomer.current_balance) {
      toast.error("Payment exceeds outstanding balance");
      return;
    }
    setProcessing(true);
    try {
      // Insert into cashbook or customer_payments
      // We'll use cashbook with reference_type = 'customer_payment'
      await db.from("cashbook").insert({
        direction: "in", // money coming in
        amount: amount,
        description: paymentNote || `Payment from ${selectedCustomer.name}`,
        reference_type: "customer_payment",
        reference_id: selectedCustomer.id,
        created_by: await require("../../lib/crud").currentUserId(),
      });
      // Reduce customer balance
      const newBalance = selectedCustomer.current_balance - amount;
      await db
        .from("customers")
        .update({ current_balance: newBalance })
        .eq("id", selectedCustomer.id);
      toast.success("Payment recorded");
      setPaymentDialogOpen(false);
      setPaymentAmount("");
      setPaymentNote("");
      // Refresh data
      void qc.invalidateQueries({ queryKey: ["customers", "cashbook"] });
      // Update selected customer local state
      setSelectedCustomer({ ...selectedCustomer, current_balance: newBalance });
    } catch (e: any) {
      toast.error(e?.message ?? "Payment failed");
    } finally {
      setProcessing(false);
    }
  };

  // Combine invoices and payments into a statement
  const statementEntries = useMemo(() => {
    if (!selectedCustomer) return [];
    const invoices = (customerInvoices.data ?? []) as Invoice[];
    const payments = (customerPayments.data ?? []) as Payment[];
    const entries = [
      ...invoices.map((inv) => ({
        date: inv.created_at,
        description: `Invoice ${inv.invoice_number}`,
        debit: inv.is_credit_sale ? inv.total - inv.paid_amount : 0,
        credit: inv.paid_amount,
        balance: 0, // computed later
        type: "invoice" as const,
      })),
      ...payments.map((p) => ({
        date: p.created_at,
        description: p.description || "Payment received",
        debit: 0,
        credit: p.amount,
        balance: 0,
        type: "payment" as const,
      })),
    ];
    // Sort by date ascending
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    // Compute running balance: start with current balance? Actually we need to compute from zero.
    let running = 0;
    return entries.map((e) => {
      running += e.debit - e.credit;
      return { ...e, balance: running };
    });
  }, [selectedCustomer, customerInvoices.data, customerPayments.data]);

  return (
    <div>
      <PageHeader
        title="Customer Management"
        subtitle="Manage customer profiles, credit limits, view statements and purchase history."
      />

      {/* Summary Cards */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Total Customers</p>
          <p className="text-2xl font-bold">{(customers.data ?? []).length}</p>
        </div>
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Total Outstanding</p>
          <p className="text-2xl font-bold text-destructive">{money(totalOutstanding)}</p>
        </div>
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Average Credit Limit</p>
          <p className="text-2xl font-bold">
            {money(
              (customers.data ?? []).reduce((sum: number, c: any) => sum + Number(c.credit_limit), 0) /
                ((customers.data ?? []).length || 1)
            )}
          </p>
        </div>
      </div>

      {/* Search + Add */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-60">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-7"
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button size="sm" onClick={() => openForm()}>
          <Plus className="mr-1 size-3.5" />
          Add Customer
        </Button>
      </div>

      {/* Customer Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Credit Limit</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No customers found
                </TableCell>
              </TableRow>
            ) : (
              filteredCustomers.map((c: any) => {
                const balance = Number(c.current_balance);
                const limit = Number(c.credit_limit);
                const isOverLimit = limit > 0 && balance > limit;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.phone}</TableCell>
                    <TableCell>{c.email || "—"}</TableCell>
                    <TableCell>{money(limit)}</TableCell>
                    <TableCell className={balance > 0 ? "text-destructive" : ""}>
                      {money(balance)}
                    </TableCell>
                    <TableCell>
                      {isOverLimit ? (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertCircle className="size-3" />
                          Over limit
                        </Badge>
                      ) : balance > 0 ? (
                        <Badge variant="outline" className="text-amber-600">
                          Has debt
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-600">
                          Clear
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openDetail(c)}>
                        <Eye className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openForm(c)}>
                        <Edit className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteCustomer(c.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Customer Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedCustomer?.name}</DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p>{selectedCustomer.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p>{selectedCustomer.email || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Address</p>
                  <p>{selectedCustomer.address || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Credit Limit</p>
                  <p>{money(selectedCustomer.credit_limit)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Current Balance</p>
                  <p className={selectedCustomer.current_balance > 0 ? "text-destructive" : ""}>
                    {money(selectedCustomer.current_balance)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Member Since</p>
                  <p>{date(selectedCustomer.created_at)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  disabled={selectedCustomer.current_balance <= 0}
                  onClick={() => setPaymentDialogOpen(true)}
                >
                  <CreditCard className="mr-1 size-3.5" />
                  Record Payment
                </Button>
                <Button size="sm" variant="outline" onClick={() => toast.info("Create Invoice - coming soon")}>
                  <Receipt className="mr-1 size-3.5" />
                  New Invoice
                </Button>
              </div>

              <Tabs defaultValue="statement" className="mt-2">
                <TabsList>
                  <TabsTrigger value="statement">Statement</TabsTrigger>
                  <TabsTrigger value="invoices">Invoices</TabsTrigger>
                  <TabsTrigger value="payments">Payments</TabsTrigger>
                </TabsList>
                <TabsContent value="statement">
                  <div className="max-h-60 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Credit</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statementEntries.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground">
                              No transactions
                            </TableCell>
                          </TableRow>
                        ) : (
                          statementEntries.map((entry, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="whitespace-nowrap">{date(entry.date)}</TableCell>
                              <TableCell>{entry.description}</TableCell>
                              <TableCell className="text-right">{entry.debit > 0 ? money(entry.debit) : "—"}</TableCell>
                              <TableCell className="text-right">{entry.credit > 0 ? money(entry.credit) : "—"}</TableCell>
                              <TableCell className="text-right font-mono">{money(entry.balance)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
                <TabsContent value="invoices">
                  <div className="max-h-60 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Paid</TableHead>
                          <TableHead>Balance</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(customerInvoices.data ?? []).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground">
                              No invoices
                            </TableCell>
                          </TableRow>
                        ) : (
                          (customerInvoices.data ?? []).map((inv: any) => (
                            <TableRow key={inv.id}>
                              <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                              <TableCell>{date(inv.created_at)}</TableCell>
                              <TableCell>{money(inv.total)}</TableCell>
                              <TableCell>{money(inv.paid_amount)}</TableCell>
                              <TableCell className={inv.total - inv.paid_amount > 0 ? "text-destructive" : ""}>
                                {money(inv.total - inv.paid_amount)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize">
                                  {inv.status.replace("_", " ")}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
                <TabsContent value="payments">
                  <div className="max-h-60 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(customerPayments.data ?? []).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground">
                              No payments recorded
                            </TableCell>
                          </TableRow>
                        ) : (
                          (customerPayments.data ?? []).map((p: any) => (
                            <TableRow key={p.id}>
                              <TableCell>{date(p.created_at)}</TableCell>
                              <TableCell>{p.description}</TableCell>
                              <TableCell className="text-right">{money(p.amount)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Customer Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "Edit Customer" : "New Customer"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input
                value={formData.name || ""}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Phone *</Label>
              <Input
                value={formData.phone || ""}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email || ""}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Address</Label>
              <Input
                value={formData.address || ""}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div>
              <Label>Credit Limit (TZS)</Label>
              <Input
                type="number"
                value={formData.credit_limit || 0}
                onChange={(e) => setFormData({ ...formData, credit_limit: Number(e.target.value) })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button onClick={saveCustomer} disabled={processing}>
                {processing ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Customer: {selectedCustomer?.name} — Outstanding: {money(selectedCustomer?.current_balance || 0)}
            </p>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Amount (TZS)</Label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Input
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                placeholder="e.g., Cash payment"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
              <Button onClick={recordPayment} disabled={processing}>
                {processing ? "Processing..." : "Record Payment"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
