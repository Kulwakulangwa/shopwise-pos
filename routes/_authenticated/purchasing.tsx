/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Edit,
  Eye,
  Plus,
  Search,
  Trash2,
  Package,
  Truck,
  ClipboardList,
  CheckCircle,
  XCircle,
  RefreshCw,
  ArrowRight,
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
import { db, useRows, currentUserId, applyStockMovement, docNumber } from "@/lib/crud";
import { money, date } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/purchasing")({
  head: () => ({
    meta: [
      { title: "Purchasing — My Shop" },
      { name: "description", content: "Manage purchase requests, purchase orders, and goods receiving." },
    ],
  }),
  component: Purchasing,
});

type PurchaseRequest = {
  id: string;
  pr_number: string;
  requested_by: string;
  warehouse_id: string;
  status: "draft" | "pending" | "approved" | "rejected";
  total: number;
  created_at: string;
  items?: any[];
};

type PurchaseOrder = {
  id: string;
  po_number: string;
  supplier_id: string;
  warehouse_id: string;
  request_id?: string;
  status: "draft" | "sent" | "partially_received" | "received" | "cancelled";
  total: number;
  created_at: string;
  items?: any[];
};

type GoodsReceipt = {
  id: string;
  gr_number: string;
  po_id: string;
  supplier_id: string;
  warehouse_id: string;
  status: "draft" | "completed";
  total: number;
  received_at: string;
  items?: any[];
};

function Purchasing() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"requests" | "orders" | "receiving">("requests");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<GoodsReceipt | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [poOpen, setPoOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Fetch data
  const requests = useRows("purchase_requests", {
    order: { column: "created_at", ascending: false },
  });
  const orders = useRows("purchase_orders", {
    order: { column: "created_at", ascending: false },
  });
  const receipts = useRows("goods_receipts", {
    order: { column: "received_at", ascending: false },
  });
  const suppliers = useRows("suppliers", { order: { column: "name", ascending: true } });
  const warehouses = useRows("warehouses", { order: { column: "name", ascending: true } });
  const products = useRows("products", { select: "id, name, sku, cost_price, tracks_serial" });
  const users = useRows("users", { select: "id, full_name" });

  // We need to fetch items for requests/POs/receipts when viewing
  const requestItems = useRows("purchase_request_items", {
    filters: selectedRequest ? [["request_id", selectedRequest.id]] : [],
  });
  const orderItems = useRows("purchase_order_items", {
    filters: selectedPO ? [["po_id", selectedPO.id]] : [],
  });
  const receiptItems = useRows("goods_receipt_items", {
    filters: selectedReceipt ? [["receipt_id", selectedReceipt.id]] : [],
  });

  // Filtered lists
  const filteredRequests = useMemo(() => {
    let list = (requests.data ?? []) as PurchaseRequest[];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        r.pr_number.toLowerCase().includes(q) ||
        (r.warehouse_id && warehouses.data?.find((w: any) => w.id === r.warehouse_id)?.name.toLowerCase().includes(q))
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }
    return list;
  }, [requests.data, search, statusFilter, warehouses.data]);

  const filteredOrders = useMemo(() => {
    let list = (orders.data ?? []) as PurchaseOrder[];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((o) =>
        o.po_number.toLowerCase().includes(q) ||
        (o.supplier_id && suppliers.data?.find((s: any) => s.id === o.supplier_id)?.name.toLowerCase().includes(q))
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((o) => o.status === statusFilter);
    }
    return list;
  }, [orders.data, search, statusFilter, suppliers.data]);

  const filteredReceipts = useMemo(() => {
    let list = (receipts.data ?? []) as GoodsReceipt[];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        r.gr_number.toLowerCase().includes(q) ||
        (r.supplier_id && suppliers.data?.find((s: any) => s.id === r.supplier_id)?.name.toLowerCase().includes(q))
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }
    return list;
  }, [receipts.data, search, statusFilter, suppliers.data]);

  // Handlers for requests
  const createRequest = () => {
    // Simplified: open a form dialog with items. For brevity, we'll use a simple modal.
    toast.info("Create Purchase Request - full form coming soon");
  };

  const approveRequest = async (id: string) => {
    try {
      await db.from("purchase_requests").update({ status: "approved" }).eq("id", id);
      toast.success("Request approved");
      void qc.invalidateQueries({ queryKey: ["purchase_requests"] });
    } catch (e: any) {
      toast.error(e?.message);
    }
  };

  const rejectRequest = async (id: string) => {
    try {
      await db.from("purchase_requests").update({ status: "rejected" }).eq("id", id);
      toast.success("Request rejected");
      void qc.invalidateQueries({ queryKey: ["purchase_requests"] });
    } catch (e: any) {
      toast.error(e?.message);
    }
  };

  // Handlers for PO
  const createPO = async (requestId?: string) => {
    // Simplified: open a form to select supplier, warehouse, and items.
    toast.info("Create Purchase Order - coming soon");
  };

  // Handlers for goods receiving
  const receiveGoods = async (poId: string) => {
    // This will process a goods receipt based on the PO.
    setProcessing(true);
    try {
      const userId = await currentUserId();
      // Get PO with items
      const { data: po, error: poErr } = await db
        .from("purchase_orders")
        .select("*, items: purchase_order_items(*)")
        .eq("id", poId)
        .single();
      if (poErr) throw poErr;
      if (!po) throw new Error("PO not found");
      if (po.status === "received") {
        toast.error("PO already fully received");
        return;
      }

      // Create goods receipt
      const grNumber = docNumber("GR");
      const { data: gr, error: grErr } = await db
        .from("goods_receipts")
        .insert({
          gr_number: grNumber,
          po_id: poId,
          supplier_id: po.supplier_id,
          warehouse_id: po.warehouse_id,
          status: "completed",
          total: po.total,
          received_at: new Date().toISOString(),
          created_by: userId,
        })
        .select("id")
        .single();
      if (grErr) throw grErr;

      // Process each item: update stock, create stock_movements, and insert receipt items
      for (const item of po.items) {
        // Insert receipt item
        await db.from("goods_receipt_items").insert({
          receipt_id: gr.id,
          product_id: item.product_id,
          quantity: item.quantity,
          cost_price: item.cost_price,
          total: item.total,
        });

        // Update stock
        await applyStockMovement({
          productId: item.product_id,
          warehouseId: po.warehouse_id,
          type: "in",
          quantity: item.quantity,
          referenceType: "goods_receipt",
          referenceId: gr.id,
          note: `GR ${grNumber} from PO ${po.po_number}`,
        });
      }

      // Mark PO as received (or partially if some items missing? For now full)
      await db
        .from("purchase_orders")
        .update({ status: "received" })
        .eq("id", poId);

      toast.success(`Goods received: ${grNumber}`);
      void qc.invalidateQueries({ queryKey: ["purchase_orders", "goods_receipts", "stock_levels", "stock_movements"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Receiving failed");
    } finally {
      setProcessing(false);
    }
  };

  // Summary stats
  const totalRequests = (requests.data ?? []).length;
  const pendingRequests = (requests.data ?? []).filter((r: any) => r.status === "pending").length;
  const totalOrders = (orders.data ?? []).length;
  const pendingOrders = (orders.data ?? []).filter((o: any) => o.status === "sent" || o.status === "partially_received").length;
  const totalReceipts = (receipts.data ?? []).length;

  return (
    <div>
      <PageHeader
        title="Purchasing"
        subtitle="Manage purchase requests, purchase orders, and goods receiving."
      />

      {/* Summary Cards */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Requests</p>
          <p className="text-2xl font-bold">{totalRequests}</p>
          <p className="text-xs text-amber-600">{pendingRequests} pending</p>
        </div>
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Purchase Orders</p>
          <p className="text-2xl font-bold">{totalOrders}</p>
          <p className="text-xs text-blue-600">{pendingOrders} active</p>
        </div>
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Goods Received</p>
          <p className="text-2xl font-bold">{totalReceipts}</p>
        </div>
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Suppliers</p>
          <p className="text-2xl font-bold">{(suppliers.data ?? []).length}</p>
        </div>
      </div>

      {/* Tabs and Filters */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="requests">Requests</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="receiving">Receiving</TabsTrigger>
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
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="partially_received">Partially Received</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => toast.info("Export - coming soon")}>
              Export
            </Button>
            {tab === "requests" && (
              <Button size="sm" onClick={createRequest}>
                <Plus className="mr-1 size-3.5" />
                New Request
              </Button>
            )}
            {tab === "orders" && (
              <Button size="sm" onClick={() => createPO()}>
                <Plus className="mr-1 size-3.5" />
                New PO
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="requests" className="mt-3">
          <RequestTable
            requests={filteredRequests}
            onApprove={approveRequest}
            onReject={rejectRequest}
            onView={(r) => {
              setSelectedRequest(r);
              setRequestOpen(true);
            }}
          />
        </TabsContent>
        <TabsContent value="orders" className="mt-3">
          <OrderTable
            orders={filteredOrders}
            onReceive={receiveGoods}
            onView={(o) => {
              setSelectedPO(o);
              setPoOpen(true);
            }}
          />
        </TabsContent>
        <TabsContent value="receiving" className="mt-3">
          <ReceiptTable
            receipts={filteredReceipts}
            onView={(r) => {
              setSelectedReceipt(r);
              setReceiptOpen(true);
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Detail Dialogs */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Request {selectedRequest?.pr_number}</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Requested By</p>
                  <p>{users.data?.find((u: any) => u.id === selectedRequest.requested_by)?.full_name || selectedRequest.requested_by}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p>{date(selectedRequest.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Warehouse</p>
                  <p>{warehouses.data?.find((w: any) => w.id === selectedRequest.warehouse_id)?.name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant="outline" className="capitalize">{selectedRequest.status}</Badge>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Items</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(requestItems.data ?? []).map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>{products.data?.find((p: any) => p.id === item.product_id)?.name || item.product_id}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{money(item.cost_price)}</TableCell>
                        <TableCell>{money(item.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end pt-2">
                <div className="font-semibold">Total: {money(selectedRequest.total)}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={poOpen} onOpenChange={setPoOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>PO {selectedPO?.po_number}</DialogTitle>
          </DialogHeader>
          {selectedPO && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Supplier</p>
                  <p>{suppliers.data?.find((s: any) => s.id === selectedPO.supplier_id)?.name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p>{date(selectedPO.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Warehouse</p>
                  <p>{warehouses.data?.find((w: any) => w.id === selectedPO.warehouse_id)?.name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant="outline" className="capitalize">{selectedPO.status}</Badge>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Items</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(orderItems.data ?? []).map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>{products.data?.find((p: any) => p.id === item.product_id)?.name || item.product_id}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{money(item.cost_price)}</TableCell>
                        <TableCell>{money(item.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end pt-2">
                <div className="font-semibold">Total: {money(selectedPO.total)}</div>
              </div>
              {selectedPO.status !== "received" && selectedPO.status !== "cancelled" && (
                <Button
                  className="w-full"
                  onClick={() => {
                    setPoOpen(false);
                    receiveGoods(selectedPO.id);
                  }}
                  disabled={processing}
                >
                  <Truck className="mr-1 size-3.5" />
                  Receive Goods
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Goods Receipt {selectedReceipt?.gr_number}</DialogTitle>
          </DialogHeader>
          {selectedReceipt && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">PO</p>
                  <p>{orders.data?.find((o: any) => o.id === selectedReceipt.po_id)?.po_number || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Supplier</p>
                  <p>{suppliers.data?.find((s: any) => s.id === selectedReceipt.supplier_id)?.name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Received At</p>
                  <p>{date(selectedReceipt.received_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Warehouse</p>
                  <p>{warehouses.data?.find((w: any) => w.id === selectedReceipt.warehouse_id)?.name || "—"}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Items</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(receiptItems.data ?? []).map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell>{products.data?.find((p: any) => p.id === item.product_id)?.name || item.product_id}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{money(item.cost_price)}</TableCell>
                        <TableCell>{money(item.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end pt-2">
                <div className="font-semibold">Total: {money(selectedReceipt.total)}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Table components
function RequestTable({ requests, onApprove, onReject, onView }: any) {
  if (!requests.length) return <div className="py-8 text-center text-muted-foreground">No purchase requests found.</div>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Request #</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Warehouse</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((r: any) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono text-xs">{r.pr_number}</TableCell>
              <TableCell>{date(r.created_at)}</TableCell>
              <TableCell>{r.warehouse?.name || "—"}</TableCell>
              <TableCell>{money(r.total)}</TableCell>
              <TableCell>
                <Badge variant={r.status === "approved" ? "default" : r.status === "pending" ? "outline" : "destructive"}>
                  {r.status}
                </Badge>
              </TableCell>
              <TableCell className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" onClick={() => onView(r)}>
                  <Eye className="size-4" />
                </Button>
                {r.status === "pending" && (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => onApprove(r.id)}>
                      <Check className="size-4 text-green-600" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onReject(r.id)}>
                      <XCircle className="size-4 text-red-600" />
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function OrderTable({ orders, onReceive, onView }: any) {
  if (!orders.length) return <div className="py-8 text-center text-muted-foreground">No purchase orders found.</div>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>PO #</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o: any) => (
            <TableRow key={o.id}>
              <TableCell className="font-mono text-xs">{o.po_number}</TableCell>
              <TableCell>{o.supplier?.name || "—"}</TableCell>
              <TableCell>{date(o.created_at)}</TableCell>
              <TableCell>{money(o.total)}</TableCell>
              <TableCell>
                <Badge variant={o.status === "received" ? "default" : o.status === "partially_received" ? "outline" : "secondary"}>
                  {o.status.replace("_", " ")}
                </Badge>
              </TableCell>
              <TableCell className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" onClick={() => onView(o)}>
                  <Eye className="size-4" />
                </Button>
                {(o.status === "sent" || o.status === "partially_received") && (
                  <Button variant="ghost" size="icon" onClick={() => onReceive(o.id)}>
                    <Truck className="size-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ReceiptTable({ receipts, onView }: any) {
  if (!receipts.length) return <div className="py-8 text-center text-muted-foreground">No goods receipts found.</div>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>GR #</TableHead>
            <TableHead>PO</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {receipts.map((r: any) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono text-xs">{r.gr_number}</TableCell>
              <TableCell>{r.po?.po_number || "—"}</TableCell>
              <TableCell>{r.supplier?.name || "—"}</TableCell>
              <TableCell>{date(r.received_at)}</TableCell>
              <TableCell>{money(r.total)}</TableCell>
              <TableCell>
                <Badge variant="default">{r.status}</Badge>
              </TableCell>
              <TableCell className="flex justify-end">
                <Button variant="ghost" size="icon" onClick={() => onView(r)}>
                  <Eye className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
