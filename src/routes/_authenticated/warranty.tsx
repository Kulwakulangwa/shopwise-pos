/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Shield,
  Search,
  Eye,
  Edit,
  CheckCircle,
  XCircle,
  Clock,
  Wrench,
  FileText,
  Calendar,
  AlertCircle,
  RefreshCw,
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

export const Route = createFileRoute("/_authenticated/warranty")({
  head: () => ({
    meta: [
      { title: "Warranty Management — My Shop" },
      { name: "description", content: "Track warranties, manage claims, and view service history." },
    ],
  }),
  component: WarrantyManagement,
});

type Warranty = {
  id: string;
  invoice_id: string;
  invoice_item_id: string;
  product_id: string;
  customer_id: string | null;
  serial: string | null;
  start_date: string;
  end_date: string;
  status: "active" | "expired" | "claimed" | "in_service" | "resolved" | "rejected";
  notes?: string;
  created_at: string;
  updated_at: string;
  // joined fields
  products?: { name: string; sku: string };
  customers?: { name: string; phone: string };
  invoices?: { invoice_number: string };
};

function WarrantyManagement() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedWarranty, setSelectedWarranty] = useState<Warranty | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editStatus, setEditStatus] = useState<string>("");
  const [editNotes, setEditNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  // Fetch warranties with joins
  const warranties = useRows("warranties", {
    select: `
      *,
      products(name, sku),
      customers(name, phone),
      invoices(invoice_number)
    `,
    order: { column: "created_at", ascending: false },
  });

  // Fetch products for filtering/search
  const products = useRows("products", { select: "id, name, sku" });
  const customers = useRows("customers", { select: "id, name, phone" });
  const invoices = useRows("invoices", { select: "id, invoice_number" });

  // Fetch service records for a warranty (if we have a service_history table)
  // We'll use a separate table "service_records" if exists, or we can just store notes.
  // For now, we'll show notes as service history.
  // We'll fetch any associated service records from a table "service_records".
  // We'll assume there is a table "service_records" with fields: warranty_id, service_date, description, cost, performed_by.
  // If not, we can skip this part and just show notes.
  const serviceRecords = useRows("service_records", {
    filters: selectedWarranty ? [["warranty_id", selectedWarranty.id]] : [],
    order: { column: "service_date", ascending: false },
  });

  // Filter warranties
  const filteredWarranties = useMemo(() => {
    let list = (warranties.data ?? []) as Warranty[];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((w) =>
        w.products?.name?.toLowerCase().includes(q) ||
        w.products?.sku?.toLowerCase().includes(q) ||
        w.serial?.toLowerCase().includes(q) ||
        w.customers?.name?.toLowerCase().includes(q) ||
        w.invoices?.invoice_number?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((w) => w.status === statusFilter);
    }
    return list;
  }, [warranties.data, search, statusFilter]);

  // Summary stats
  const totalWarranties = (warranties.data ?? []).length;
  const activeWarranties = (warranties.data ?? []).filter((w: any) => w.status === "active" || w.status === "in_service").length;
  const claimedWarranties = (warranties.data ?? []).filter((w: any) => w.status === "claimed").length;
  const resolvedWarranties = (warranties.data ?? []).filter((w: any) => w.status === "resolved").length;

  // Handlers
  const viewWarranty = (warranty: Warranty) => {
    setSelectedWarranty(warranty);
    setDetailOpen(true);
  };

  const openEdit = (warranty: Warranty) => {
    setSelectedWarranty(warranty);
    setEditStatus(warranty.status);
    setEditNotes(warranty.notes || "");
    setEditOpen(true);
  };

  const updateWarranty = async () => {
    if (!selectedWarranty) return;
    setProcessing(true);
    try {
      await db
        .from("warranties")
        .update({
          status: editStatus,
          notes: editNotes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedWarranty.id);
      toast.success("Warranty updated");
      setEditOpen(false);
      // Invalidate queries
      void qc.invalidateQueries({ queryKey: ["warranties"] });
      // Also refresh detail if open
      if (detailOpen) {
        // We'll need to refetch selected warranty? We'll just close detail and reopen.
        setDetailOpen(false);
        setTimeout(() => {
          setSelectedWarranty({ ...selectedWarranty, status: editStatus, notes: editNotes });
          setDetailOpen(true);
        }, 100);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Update failed");
    } finally {
      setProcessing(false);
    }
  };

  // Get status badge color
  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      active: "bg-green-100 text-green-800",
      expired: "bg-gray-100 text-gray-800",
      claimed: "bg-blue-100 text-blue-800",
      in_service: "bg-yellow-100 text-yellow-800",
      resolved: "bg-green-600 text-white",
      rejected: "bg-red-100 text-red-800",
    };
    return variants[status] || "bg-gray-100 text-gray-800";
  };

  return (
    <div>
      <PageHeader
        title="Warranty Management"
        subtitle="Track warranty registrations, manage claims, and view service history."
      />

      {/* Summary Cards */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Total Warranties</p>
          <p className="text-2xl font-bold">{totalWarranties}</p>
        </div>
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Active / In Service</p>
          <p className="text-2xl font-bold text-green-600">{activeWarranties}</p>
        </div>
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Claimed</p>
          <p className="text-2xl font-bold text-blue-600">{claimedWarranties}</p>
        </div>
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Resolved</p>
          <p className="text-2xl font-bold text-green-600">{resolvedWarranties}</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-60">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-7"
              placeholder="Search by product, serial, customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="claimed">Claimed</SelectItem>
              <SelectItem value="in_service">In Service</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" variant="outline" onClick={() => toast.info("Export - coming soon")}>
          Export
        </Button>
      </div>

      {/* Warranty Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Serial</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>End Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredWarranties.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No warranties found.
                </TableCell>
              </TableRow>
            ) : (
              filteredWarranties.map((w: any) => {
                const isExpired = new Date(w.end_date) < new Date();
                const statusDisplay = isExpired && w.status === "active" ? "expired" : w.status;
                return (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{w.products?.name || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{w.serial || "—"}</TableCell>
                    <TableCell>{w.customers?.name || "Walk-in"}</TableCell>
                    <TableCell>{date(w.start_date)}</TableCell>
                    <TableCell>{date(w.end_date)}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadge(statusDisplay)}>
                        {statusDisplay.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => viewWarranty(w)}>
                        <Eye className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(w)}>
                        <Edit className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Warranty Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Warranty Detail
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {selectedWarranty?.products?.name}
              </span>
            </DialogTitle>
          </DialogHeader>
          {selectedWarranty && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Product</p>
                  <p>{selectedWarranty.products?.name}</p>
                  <p className="text-xs">SKU: {selectedWarranty.products?.sku}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Serial Number</p>
                  <p className="font-mono">{selectedWarranty.serial || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p>{selectedWarranty.customers?.name || "Walk-in"}</p>
                  <p className="text-xs">{selectedWarranty.customers?.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Invoice</p>
                  <p>{selectedWarranty.invoices?.invoice_number || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Start Date</p>
                  <p>{date(selectedWarranty.start_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">End Date</p>
                  <p>{date(selectedWarranty.end_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge className={getStatusBadge(selectedWarranty.status)}>
                    {selectedWarranty.status.replace("_", " ")}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Registered On</p>
                  <p>{date(selectedWarranty.created_at)}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="rounded-md bg-muted p-2 text-sm">
                  {selectedWarranty.notes || "No notes"}
                </p>
              </div>

              {/* Service History */}
              <div>
                <p className="text-xs text-muted-foreground">Service History</p>
                <div className="max-h-40 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead>Performed By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(serviceRecords.data ?? []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            No service records.
                          </TableCell>
                        </TableRow>
                      ) : (
                        (serviceRecords.data ?? []).map((sr: any) => (
                          <TableRow key={sr.id}>
                            <TableCell>{date(sr.service_date)}</TableCell>
                            <TableCell>{sr.description}</TableCell>
                            <TableCell>{money(sr.cost)}</TableCell>
                            <TableCell>{sr.performed_by || "—"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(selectedWarranty)}>
                  <Edit className="mr-1 size-3.5" />
                  Update Status
                </Button>
                <Button variant="outline" size="sm" onClick={() => toast.info("Add service record - coming soon")}>
                  <Wrench className="mr-1 size-3.5" />
                  Add Service
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Warranty Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Warranty</DialogTitle>
          </DialogHeader>
          {selectedWarranty && (
            <div className="space-y-4">
              <div>
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="claimed">Claimed</SelectItem>
                    <SelectItem value="in_service">In Service</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Input
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Add notes about the claim/service"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                <Button onClick={updateWarranty} disabled={processing}>
                  {processing ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
