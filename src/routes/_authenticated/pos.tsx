/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { applyStockMovement, currentUserId, db, recordCash, useRows } from "@/lib/crud";
import { docNumber, money, num } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/pos")({
  head: () => ({
    meta: [
      { title: "Point of Sale — My Shop" },
      { name: "description", content: "Fast keyboard-friendly checkout with serial selection and credit checks." },
      { property: "og:title", content: "Point of Sale — My Shop" },
      { property: "og:description", content: "Fast counter checkout for wholesale electronics." },
    ],
  }),
  component: POS,
});

type Line = { productId: string; name: string; price: number; cost: number; qty: number; tracksSerial: boolean; serials: string[] };

function POS() {
  const qc = useQueryClient();
  const products = useRows("products", { select: "*", filters: [["is_active", true]], order: { column: "name", ascending: true } });
  const warehouses = useRows("warehouses", { order: { column: "name", ascending: true } });
  const customers = useRows("customers", { order: { column: "name", ascending: true } });
  const stock = useRows("stock_levels");
  const serials = useRows("serial_numbers", { filters: [["status", "in_stock"]] });
  const settings = useRows("system_settings");

  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [credit, setCredit] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const blockOverLimit = useMemo(() => {
    const row = (settings.data ?? []).find((s: any) => s.key === "credit_limit_action");
    return row?.value === "block" || row?.value?.mode === "block";
  }, [settings.data]);

  const onHand = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of (stock.data ?? []) as any[]) {
      if (warehouseId && s.warehouse_id !== warehouseId) continue;
      m.set(s.product_id, (m.get(s.product_id) ?? 0) + Number(s.quantity));
    }
    return m;
  }, [stock.data, warehouseId]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = (products.data ?? []) as any[];
    if (!q) return rows.slice(0, 12);
    return rows.filter((p) => `${p.sku} ${p.name} ${p.brand ?? ""} ${p.model ?? ""}`.toLowerCase().includes(q)).slice(0, 12);
  }, [products.data, query]);

  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const total = Math.max(0, subtotal - discount);
  const customer = (customers.data ?? []).find((c: any) => c.id === customerId) as any;
  const projectedBalance = customer ? Number(customer.current_balance ?? 0) + (credit ? total : 0) : 0;
  const overLimit = !!customer && credit && Number(customer.credit_limit ?? 0) > 0 && projectedBalance > Number(customer.credit_limit);

  const addLine = (p: any) => {
    setLines((cur) => {
      const found = cur.find((l) => l.productId === p.id);
      if (found) return cur.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + 1 } : l));
      return [
        ...cur,
        {
          productId: p.id,
          name: p.name,
          price: Number(p.selling_price ?? 0),
          cost: Number(p.cost_price ?? 0),
          qty: 1,
          tracksSerial: !!p.tracks_serial,
          serials: [],
        },
      ];
    });
    setQuery("");
  };

  const setQty = (id: string, qty: number) =>
    setLines((cur) => cur.map((l) => (l.productId === id ? { ...l, qty: Math.max(1, qty) } : l)));

  const checkout = async () => {
    if (!lines.length) return toast.error("Cart is empty");
    if (!warehouseId) return toast.error("Choose a warehouse");
    if (credit && !customerId) return toast.error("Credit sales need a customer");
    for (const l of lines) {
      if (l.tracksSerial && l.serials.length !== l.qty) {
        return toast.error(`Select ${l.qty} serial number(s) for ${l.name}`);
      }
    }
    if (overLimit && blockOverLimit) return toast.error("Credit limit exceeded — sale blocked");

    setBusy(true);
    try {
      const userId = await currentUserId();
      const paidAmount = credit ? Number(paid || 0) : total;
      const { data: invoice, error } = await db
        .from("invoices")
        .insert({
          invoice_number: docNumber("INV"),
          customer_id: customerId || null,
          warehouse_id: warehouseId,
          status: paidAmount >= total ? "paid" : paidAmount > 0 ? "partially_paid" : "unpaid",
          is_credit_sale: credit,
          subtotal,
          discount,
          tax: 0,
          total,
          paid_amount: paidAmount,
          payment_method: credit ? "credit" : "cash",
          created_by: userId,
        })
        .select("id, invoice_number")
        .single();
      if (error) throw error;

      for (const l of lines) {
        const { data: item, error: itemErr } = await db
          .from("invoice_items")
          .insert({
            invoice_id: invoice.id,
            product_id: l.productId,
            quantity: l.qty,
            unit_price: l.price,
            cost_price: l.cost,
            discount: 0,
            total: l.price * l.qty,
            serials: l.serials,
          })
          .select("id")
          .single();
        if (itemErr) throw itemErr;

        await applyStockMovement({
          productId: l.productId,
          warehouseId,
          type: "out",
          quantity: l.qty,
          referenceType: "invoice",
          referenceId: invoice.id,
          note: `Sale ${invoice.invoice_number}`,
        });

        if (l.serials.length) {
          await db
            .from("serial_numbers")
            .update({ status: "sold", invoice_id: invoice.id })
            .in("serial", l.serials);
        }

        const product = (products.data ?? []).find((p: any) => p.id === l.productId) as any;
        const months = Number(product?.warranty_months ?? 0);
        if (months > 0) {
          const start = new Date();
          const end = new Date(start);
          end.setMonth(end.getMonth() + months);
          const serialList = l.serials.length ? l.serials : [null];
          for (const s of serialList) {
            await db.from("warranties").insert({
              invoice_id: invoice.id,
              invoice_item_id: item.id,
              product_id: l.productId,
              customer_id: customerId || null,
              serial: s,
              start_date: start.toISOString().slice(0, 10),
              end_date: end.toISOString().slice(0, 10),
              status: "active",
            });
          }
        }
      }

      if (credit && customerId) {
        const owed = total - paidAmount;
        await db
          .from("customers")
          .update({ current_balance: Number(customer?.current_balance ?? 0) + owed })
          .eq("id", customerId);
      }
      if (paidAmount > 0) {
        await recordCash({
          direction: "in",
          amount: paidAmount,
          description: `Sale ${invoice.invoice_number}`,
          referenceType: "invoice",
          referenceId: invoice.id,
        });
      }

      toast.success(`${invoice.invoice_number} completed`);
      setLines([]);
      setDiscount(0);
      setPaid("");
      setCredit(false);
      for (const k of ["invoices", "stock_levels", "stock_movements", "customers", "dashboard", "warranties", "serial_numbers"]) {
        void qc.invalidateQueries({ queryKey: [k] });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Checkout failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Point of Sale" subtitle="Type to search, Enter adds the first match, then complete the sale." />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="tile p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              className="pl-9"
              placeholder="Search product by name, SKU, brand or model"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0]) addLine(results[0]);
              }}
            />
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {results.map((p: any) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addLine(p)}
                className="rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary hover:bg-accent"
              >
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="truncate text-xs text-muted-foreground">{p.sku}</p>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="num font-semibold">{money(p.selling_price)}</span>
                  <span className="text-muted-foreground">{num(onHand.get(p.id) ?? 0)} in stock</span>
                </div>
              </button>
            ))}
            {!results.length && <p className="text-sm text-muted-foreground">No matching products.</p>}
          </div>

          <div className="mt-5 space-y-2">
            {lines.map((l) => (
              <div key={l.productId} className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.name}</p>
                    <p className="num text-xs text-muted-foreground">{money(l.price)} each</p>
                  </div>
                  <Button variant="outline" size="icon" className="size-7" onClick={() => setQty(l.productId, l.qty - 1)}>
                    <Minus className="size-3" />
                  </Button>
                  <span className="num w-8 text-center text-sm">{l.qty}</span>
                  <Button variant="outline" size="icon" className="size-7" onClick={() => setQty(l.productId, l.qty + 1)}>
                    <Plus className="size-3" />
                  </Button>
                  <span className="num w-28 text-right text-sm font-semibold">{money(l.price * l.qty)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => setLines((cur) => cur.filter((x) => x.productId !== l.productId))}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>

                {l.tracksSerial && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {((serials.data ?? []) as any[])
                      .filter((s) => s.product_id === l.productId && (!warehouseId || s.warehouse_id === warehouseId))
                      .map((s) => {
                        const picked = l.serials.includes(s.serial);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() =>
                              setLines((cur) =>
                                cur.map((x) =>
                                  x.productId === l.productId
                                    ? {
                                        ...x,
                                        serials: picked
                                          ? x.serials.filter((v) => v !== s.serial)
                                          : [...x.serials, s.serial],
                                      }
                                    : x,
                                ),
                              )
                            }
                            className={`rounded-md border px-2 py-1 text-xs ${picked ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                          >
                            {s.serial}
                          </button>
                        );
                      })}
                    <span className="self-center text-xs text-muted-foreground">
                      {l.serials.length}/{l.qty} selected
                    </span>
                  </div>
                )}
              </div>
            ))}
            {!lines.length && <p className="text-sm text-muted-foreground">Cart is empty.</p>}
          </div>
        </div>

        <div className="tile h-fit p-4">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Warehouse</Label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                <SelectContent>
                  {(warehouses.data ?? []).map((w: any) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Customer</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="Walk-in customer" /></SelectTrigger>
                <SelectContent>
                  {(customers.data ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="credit">Credit sale</Label>
              <Switch id="credit" checked={credit} onCheckedChange={setCredit} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="disc">Discount (TZS)</Label>
              <Input id="disc" type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value || 0))} />
            </div>

            {credit && (
              <div className="space-y-1.5">
                <Label htmlFor="paid">Amount paid now (TZS)</Label>
                <Input id="paid" type="number" value={paid} onChange={(e) => setPaid(e.target.value)} />
              </div>
            )}

            {overLimit && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                Credit limit exceeded: balance would be {money(projectedBalance)} against a limit of {money(customer?.credit_limit)}.
                {blockOverLimit ? " This sale is blocked." : " Proceed with caution."}
              </p>
            )}

            <div className="space-y-1 border-t border-border pt-3 text-sm">
              <Row label="Subtotal" value={money(subtotal)} />
              <Row label="Discount" value={money(discount)} />
              <div className="flex items-center justify-between pt-1 text-base font-semibold">
                <span>Total</span>
                <span className="num">{money(total)}</span>
              </div>
            </div>

            <Button className="w-full" size="lg" disabled={busy} onClick={checkout}>
              {busy ? "Processing..." : "Complete sale"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="num">{value}</span>
    </div>
  );
}
