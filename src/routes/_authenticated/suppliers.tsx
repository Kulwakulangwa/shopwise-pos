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
  Truck,
  Package,
  DollarSign,
  FileText,
  CreditCard,
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
import { money, date } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({
    meta: [
      { title: "Supplier Management — My Shop" },
      { name: "description", content: "Manage supplier profiles, purchase orders, and payments." },
    ],
  }),
  component: SupplierManagement,
});

type Supplier = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  contact_person?: string;
  tax_id?: string;
  current_balance: number;
  created_at: string;
};

type PurchaseOrder = {
  id: string;
  po_number: string;
  supplier_id: string;
  warehouse_id: string;
  status: "draft" | "sent" | "received" | "partially_received" | "cancelled";
  total: number;
  paid_amount: number;
  created_at: string;
};

type SupplierInvoice = {
  id: string;
  invoice_number: string;
  supplier_id: string;
  po_id?: string;
  total: number;
  paid_amount: number;
  status: "unpaid" | "partially_paid" | "paid";
  created_at: string;
};

function SupplierManagement() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState<Partial<Supplier>>({});
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [processing, setProcessing] = useState(false);

  // Fetch suppliers
  const suppliers = useRows("suppliers", {
    order: { column: "name", ascending: true },
  });

  // Fetch purchase orders for selected supplier
  const supplierPOs = useRows("purchase_orders", {
    filters: selectedSupplier ? [["supplier_id", selectedSupplier.id]] : [],
    order: { column: "created_at", ascending: false },
  });

  // Fetch supplier invoices
  const supplierInvoices = useRows("supplier_invoices", {
    filters: selectedSupplier ? [["supplier_id", selectedSupplier.id]] : [],
    order: { column: "created_at", ascending: false },
  });

  // Fetch supplier payments (from cashbook with reference_type = 'supplier_payment')
  const supplierPayments = useRows("cashbook", {
    filters: selectedSupplier ? [
      ["reference_type", "supplier_payment"],
      ["reference_id", selectedSupplier.id],
    ] : [],
    order: { column: "created_at", ascending: false },
  });

  // Filter suppliers by search
  const filteredSuppliers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return suppliers.data ?? [];
    return (suppliers.data ?? []).filter((s: any) =>
      s.name.toLowerCase().includes(q) ||
      s.phone.includes(q) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.contact_person && s.contact_person.toLowerCase().includes(q))
    );
  }, [suppliers.data, search]);

  // Total supplier payables (outstanding)
  const totalPayables = useMemo(() => {
    return (suppliers.data ?? []).reduce((sum: number, s: any) => sum + Number(s.current_balance), 0);
  }, [suppliers.data]);

  // Handlers
  const openDetail = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setDetailOpen(true);
  };

  const openForm = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData(supplier);
    } else {
      setEditingSupplier(null);
      setFormData({
        name: "",
        phone: "",
        email: "",
        address: "",
        contact_person: "",
        tax_id: "",
      });
    }
    setFormOpen(true);
  };

  const saveSupplier = async () => {
    if (!formData.name || !formData.phone) {
      toast.error("Name and phone are required");
      return;
    }
    setProcessing(true);
    try {
      if (editingSupplier) {
        await db
          .from("suppliers")
          .update({
            name: formData.name,
            phone: formData.phone,
            email: formData.email || null,
            address: formData.address || null,
            contact_person: formData.contact_person || null,
            tax_id: formData.tax_id || null,
          })
          .eq("id", editingSupplier.id);
        toast.success("Supplier updated");
      } else {
        await db.from("suppliers").insert({
          name: formData.name,
          phone: formData.phone,
          email: formData.email || null,
          address: formData.address || null,
          contact_person: formData.contact_person || null,
          tax_id: formData.tax_id || null,
          current_balance: 0,
        });
        toast.success("Supplier created");
      }
      setFormOpen(false);
      setEditingSupplier(null);
      setFormData({});
      void qc.invalidateQueries({ queryKey: ["suppliers"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save supplier");
    } finally {
      setProcessing(false);
    }
  };

  const deleteSupplier = async (id: string) => {
    if (!confirm("Delete this supplier? This cannot be undone.")) return;
    try {
      await db.from("suppliers").delete().eq("id", id);
      toast.success("Supplier deleted");
      void qc.invalidateQueries({ queryKey: ["suppliers"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed");
    }
  };

  const recordPayment = async () => {
    if (!selectedSupplier) return;
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (amount > selectedSupplier.current_balance) {
      toast.error("Payment exceeds outstanding balance");
      return;
    }
    setProcessing(true);
    try {
      // Insert into cashbook (money going out = payment to supplier)
      await db.from("cashbook").insert({
        direction: "out",
        amount: amount,
        description: paymentNote || `Payment to ${selectedSupplier.name}`,
        reference_type: "supplier_payment",
        reference_id: selectedSupplier.id,
        created_by: await currentUserId(),
      });
      // Reduce supplier balance
      const newBalance = selectedSupplier.current_balance - amount;
      await db
        .from("suppliers")
        .update({ current_balance: newBalance })
        .eq("id", selectedSupplier.id);
      toast.success("Payment recorded");
      setPaymentDialogOpen(false);
      setPaymentAmount("");
      setPaymentNote("");
      void qc.invalidateQueries({ queryKey: ["suppliers", "cashbook"] });
      setSelectedSupplier({ ...selectedSupplier, current_balance: newBalance });
    } catch (e: any) {
      toast.error(e?.message ?? "Payment failed");
    } finally {
      setProcessing(false);
    }
  };

  // Statement entries (POs + invoices + payments)
  const statementEntries = useMemo(() => {
    if (!selectedSupplier) return [];
    const pos = (supplierPOs.data ?? []) as PurchaseOrder[];
    const invs = (supplierInvoices.data ?? []) as SupplierInvoice[];
    const payments = (supplierPayments.data ?? []) as any[];

    const entries = [
      ...pos.map((po) => ({
        date: po.created_at,
        description: `Purchase Order ${po.po_number}`,
        debit: po.total - po.paid_amount, // outstanding balance from PO
        credit: 0,
        type: "po" as const,
      })),
      ...invs.map((inv) => ({
        date: inv.created_at,
        description: `Supplier Invoice ${inv.invoice_number}`,
        debit: inv.total - inv.paid_amount,
        credit: 0,
        type: "invoice" as const,
      })),
      ...payments.map((p) => ({
        date: p.created_at,
        description: p.description || "Payment made",
        debit: 0,
        credit: p.amount,
        type: "payment" as const,
      })),
    ];
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let running = 0;
    return entries.map((e) => {
      running += e.debit - e.credit;
      return { ...e, balance: running };
    });
  }, [selectedSupplier, supplierPOs.data, supplierInvoices.data, supplierPayments.data]);

  return (
    <div>
      <PageHeader
        title="Supplier Management"
        subtitle="Manage supplier profiles, purchase orders, invoices, and payments."
      />

      {/* Summary Cards */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Total Suppliers</p>
          <p className="text-2xl font-bold">{(suppliers.data ?? []).length}</p>
        </div>
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Total Payables</p>
          <p className="text-2xl font-bold text-destructive">{money(totalPayables)}</p>
        </div>
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Avg Payable</p>
          <p className="text-2xl font-bold">
            {money(
              totalPayables / ((suppliers.data ?? []).length || 1)
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
            placeholder="Search suppliers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button size="sm" onClick={() => openForm()}>
          <Plus className="mr-1 size-3.5" />
          Add Supplier
        </Button>
      </div>

      {/* Supplier Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Contact Person</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSuppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No suppliers found
                </TableCell>
              </TableRow>
            ) : (
              filteredSuppliers.map((s: any) => {
                const balance = Number(s.current_balance);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.phone}</TableCell>
                    <TableCell>{s.contact_person || "—"}</TableCell>
                    <TableCell className={balance > 0 ? "text-destructive" : ""}>
                      {money(balance)}
                    </TableCell>
                    <TableCell className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openDetail(s)}>
                        <Eye className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openForm(s)}>
                        <Edit className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteSupplier(s.id)}>
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

      {/* Supplier Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedSupplier?.name}</DialogTitle>
          </DialogHeader>
          {selectedSupplier && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p>{selectedSupplier.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p>{selectedSupplier.email || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Address</p>
                  <p>{selectedSupplier.address || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Contact Person</p>
                  <p>{selectedSupplier.contact_person || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tax ID</p>
                  <p>{selectedSupplier.tax_id || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Current Balance</p>
                  <p className={selectedSupplier.current_balance > 0 ? "text-destructive" : ""}>
                    {money(selectedSupplier.current_balance)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  disabled={selectedSupplier.current_balance <= 0}
                  onClick={() => setPaymentDialogOpen(true)}
                >
                  <CreditCard className="mr-1 size-3.5" />
                  Record Payment
                </Button>
                <Button size="sm" variant="outline" onClick={() => toast.info("Create PO - coming soon")}>
                  <Package className="mr-1 size-3.5" />
                  New PO
                </Button>
              </div>

              <Tabs defaultValue="statement" className="mt-2">
                <TabsList>
                  <TabsTrigger value="statement">Statement</TabsTrigger>
                  <TabsTrigger value="pos">Purchase Orders</TabsTrigger>
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
                <TabsContent value="pos">
                  <div className="max-h-60 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>PO #</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Paid</TableHead>
                          <TableHead>Balance</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(supplierPOs.data ?? []).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground">
                              No purchase orders
                            </TableCell>
                          </TableRow>
                        ) : (
                          (supplierPOs.data ?? []).map((po: any) => (
                            <TableRow key={po.id}>
                              <TableCell className="font-mono text-xs">{po.po_number}</TableCell>
                              <TableCell>{date(po.created_at)}</TableCell>
                              <TableCell>{money(po.total)}</TableCell>
                              <TableCell>{money(po.paid_amount || 0)}</TableCell>
                              <TableCell className={po.total - (po.paid_amount || 0) > 0 ? "text-destructive" : ""}>
                                {money(po.total - (po.paid_amount || 0))}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize">
                                  {po.status.replace("_", " ")}
                                </Badge>
                              </TableCell>
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
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Paid</TableHead>
                          <TableHead>Balance</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(supplierInvoices.data ?? []).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground">
                              No supplier invoices
                            </TableCell>
                          </TableRow>
                        ) : (
                          (supplierInvoices.data ?? []).map((inv: any) => (
                            <TableRow key={inv.id}>
                              <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                              <TableCell>{date(inv.created_at)}</TableCell>
                              <TableCell>{money(inv.total)}</TableCell>
                              <TableCell>{money(inv.paid_amount || 0)}</TableCell>
                              <TableCell className={inv.total - (inv.paid_amount || 0) > 0 ? "text-destructive" : ""}>
                                {money(inv.total - (inv.paid_amount || 0))}
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
                        {(supplierPayments.data ?? []).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground">
                              No payments recorded
                            </TableCell>
                          </TableRow>
                        ) : (
                          (supplierPayments.data ?? []).map((p: any) => (
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

      {/* Add/Edit Supplier Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSupplier ? "Edit Supplier" : "New Supplier"}</DialogTitle>
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
              <Label>Contact Person</Label>
              <Input
                value={formData.contact_person || ""}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              />
            </div>
            <div>
              <Label>Tax ID (optional)</Label>
              <Input
                value={formData.tax_id || ""}
                onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button onClick={saveSupplier} disabled={processing}>
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
            <DialogTitle>Record Payment to Supplier</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Supplier: {selectedSupplier?.name} — Outstanding: {money(selectedSupplier?.current_balance || 0)}
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
                placeholder="e.g., Bank transfer"
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
