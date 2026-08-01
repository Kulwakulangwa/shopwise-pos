/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SectionCard, StatCard } from "@/components/ui-kit";
import { DataTable } from "@/components/DataTable";
import { FormDialog, type Field } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { applyStockMovement, useRows, useSaveRow, useDeleteRow, db } from "@/lib/crud";
import { dateTime, money, num, generateSKU } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — My Shop" },
      { name: "description", content: "Products, categories, warehouses, stock movements, serials and valuation." },
      { property: "og:title", content: "Inventory — My Shop" },
      { property: "og:description", content: "Multi-warehouse stock control for electronics." },
    ],
  }),
  component: Inventory,
});

function Inventory() {
  const qc = useQueryClient();
  const products = useRows("products", { select: "*, categories(name)", order: { column: "created_at" } });
  const categories = useRows("categories", { order: { column: "name", ascending: true } });
  const warehouses = useRows("warehouses", { order: { column: "name", ascending: true } });
  const stock = useRows("stock_levels", { select: "*, products(name, sku, cost_price), warehouses(name)" });
  const movements = useRows("stock_movements", {
    select: "*, products(name), warehouses(name)",
    order: { column: "created_at" },
  });
  const serials = useRows("serial_numbers", { select: "*, products(name), warehouses(name)", order: { column: "created_at" } });

  const saveProduct = useSaveRow("products");
  const saveCategory = useSaveRow("categories");
  const saveWarehouse = useSaveRow("warehouses");
  const removeProduct = useDeleteRow("products");

  const [productOpen, setProductOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [generatedSku, setGeneratedSku] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [warehouseOpen, setWarehouseOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState<null | "in" | "out" | "adjustment">(null);

  const productOptions = (products.data ?? []).map((p: any) => ({ value: p.id, label: `${p.sku} — ${p.name}` }));
  const warehouseOptions = (warehouses.data ?? []).map((w: any) => ({ value: w.id, label: w.name }));

  const onHandByProduct = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of (stock.data ?? []) as any[]) m.set(s.product_id, (m.get(s.product_id) ?? 0) + Number(s.quantity));
    return m;
  }, [stock.data]);

  const lowStock = (products.data ?? []).filter(
    (p: any) => p.is_active && (onHandByProduct.get(p.id) ?? 0) <= Number(p.reorder_level ?? 0),
  );

  const valuationByWarehouse = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of (stock.data ?? []) as any[]) {
      const key = s.warehouses?.name ?? "Unassigned";
      m.set(key, (m.get(key) ?? 0) + Number(s.quantity) * Number(s.products?.cost_price ?? 0));
    }
    return [...m.entries()].map(([warehouse, value]) => ({ id: warehouse, warehouse, value }));
  }, [stock.data]);

  const totalValue = valuationByWarehouse.reduce((s, r) => s + r.value, 0);

  const productFields: Field[] = [
    { name: "sku", label: "SKU", required: true, half: true },
    { name: "name", label: "Product name", required: true, half: true },
    {
      name: "category_id",
      label: "Category",
      type: "select",
      half: true,
      options: (categories.data ?? []).map((c: any) => ({ value: c.id, label: c.name })),
    },
    { name: "brand", label: "Brand", half: true },
    { name: "model", label: "Model", half: true },
    { name: "unit", label: "Unit", half: true, placeholder: "pcs" },
    { name: "cost_price", label: "Cost price (TZS)", type: "number", required: true, half: true },
    { name: "selling_price", label: "Selling price (TZS)", type: "number", required: true, half: true },
    { name: "reorder_level", label: "Reorder level", type: "number", half: true },
    { name: "warranty_months", label: "Warranty (months)", type: "number", half: true },
    { name: "tracks_serial", label: "Track serial numbers", type: "switch", half: true },
    { name: "is_active", label: "Active", type: "switch", half: true },
  ];

  const moveFields: Field[] = [
    { name: "product_id", label: "Product", type: "select", required: true, options: productOptions },
    { name: "warehouse_id", label: "Warehouse", type: "select", required: true, options: warehouseOptions },
    {
      name: "quantity",
      label: moveOpen === "adjustment" ? "Adjustment (+/-)" : "Quantity",
      type: "number",
      required: true,
      half: true,
    },
    { name: "note", label: "Note", type: "textarea" },
  ];

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Stock control across warehouses, with serial tracking and valuation."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setCategoryOpen(true)}>
              New category
            </Button>
            <Button variant="outline" size="sm" onClick={() => setWarehouseOpen(true)}>
              New warehouse
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setGeneratedSku(generateSKU());
                setProductOpen(true);
              }}
            >
              <Plus className="size-4" /> Product
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Products" value={num(products.data?.length)} />
        <StatCard label="Warehouses" value={num(warehouses.data?.length)} />
        <StatCard label="Low stock" value={num(lowStock.length)} tone="warning" />
        <StatCard label="Inventory value" value={money(totalValue)} tone="primary" />
      </div>

      <Tabs defaultValue="products">
        <TabsList className="flex-wrap">
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="stock">Stock levels</TabsTrigger>
          <TabsTrigger value="movements">Movements</TabsTrigger>
          <TabsTrigger value="serials">Serial numbers</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
          <TabsTrigger value="valuation">Valuation</TabsTrigger>
          <TabsTrigger value="low">Low stock</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          <DataTable
            loading={products.isLoading}
            rows={products.data ?? []}
            exportName="products"
            searchKeys={(r: any) => `${r.sku} ${r.name} ${r.brand ?? ""} ${r.model ?? ""}`}
            onRowClick={(r: any) => {
              setEditing(r);
              setProductOpen(true);
            }}
            columns={[
              { key: "sku", header: "SKU" },
              { key: "name", header: "Product" },
              { key: "category", header: "Category", render: (r: any) => r.categories?.name ?? "—", value: (r: any) => r.categories?.name ?? "" },
              { key: "cost_price", header: "Cost", render: (r: any) => money(r.cost_price), value: (r: any) => r.cost_price },
              { key: "selling_price", header: "Price", render: (r: any) => money(r.selling_price), value: (r: any) => r.selling_price },
              { key: "onhand", header: "On hand", render: (r: any) => num(onHandByProduct.get(r.id) ?? 0), value: (r: any) => onHandByProduct.get(r.id) ?? 0 },
              { key: "reorder_level", header: "Reorder" },
              { key: "tracks_serial", header: "Serials", render: (r: any) => (r.tracks_serial ? "Yes" : "No") },
              {
                key: "actions",
                header: "",
                render: (r: any) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete ${r.name}?`)) removeProduct.mutate(r.id);
                    }}
                  >
                    Delete
                  </Button>
                ),
              },
            ]}
          />
        </TabsContent>

        <TabsContent value="stock" className="mt-4">
          <div className="mb-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setMoveOpen("in")}>Stock in</Button>
            <Button size="sm" variant="outline" onClick={() => setMoveOpen("out")}>Stock out</Button>
            <Button size="sm" variant="outline" onClick={() => setMoveOpen("adjustment")}>Adjustment</Button>
          </div>
          <DataTable
            loading={stock.isLoading}
            rows={stock.data ?? []}
            exportName="stock-levels"
            searchKeys={(r: any) => `${r.products?.name ?? ""} ${r.warehouses?.name ?? ""}`}
            columns={[
              { key: "product", header: "Product", render: (r: any) => r.products?.name ?? "—", value: (r: any) => r.products?.name ?? "" },
              { key: "sku", header: "SKU", render: (r: any) => r.products?.sku ?? "—", value: (r: any) => r.products?.sku ?? "" },
              { key: "warehouse", header: "Warehouse", render: (r: any) => r.warehouses?.name ?? "—", value: (r: any) => r.warehouses?.name ?? "" },
              { key: "quantity", header: "Quantity", render: (r: any) => num(r.quantity), value: (r: any) => r.quantity },
              { key: "value", header: "Value", render: (r: any) => money(Number(r.quantity) * Number(r.products?.cost_price ?? 0)) },
              { key: "updated_at", header: "Updated", render: (r: any) => dateTime(r.updated_at) },
            ]}
          />
        </TabsContent>

        <TabsContent value="movements" className="mt-4">
          <DataTable
            loading={movements.isLoading}
            rows={movements.data ?? []}
            exportName="stock-movements"
            searchKeys={(r: any) => `${r.products?.name ?? ""} ${r.movement_type} ${r.reference_type ?? ""}`}
            columns={[
              { key: "created_at", header: "Date", render: (r: any) => dateTime(r.created_at) },
              { key: "product", header: "Product", render: (r: any) => r.products?.name ?? "—", value: (r: any) => r.products?.name ?? "" },
              { key: "warehouse", header: "Warehouse", render: (r: any) => r.warehouses?.name ?? "—" },
              { key: "movement_type", header: "Type" },
              { key: "quantity", header: "Qty", render: (r: any) => num(r.quantity), value: (r: any) => r.quantity },
              { key: "reference_type", header: "Reference" },
              { key: "note", header: "Note" },
            ]}
          />
        </TabsContent>

        <TabsContent value="serials" className="mt-4">
          <SerialsTab serials={serials} productOptions={productOptions} warehouseOptions={warehouseOptions} />
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <DataTable
            loading={categories.isLoading}
            rows={categories.data ?? []}
            exportName="categories"
            searchKeys={(r: any) => r.name}
            columns={[
              { key: "name", header: "Category" },
              { key: "description", header: "Description" },
            ]}
          />
        </TabsContent>

        <TabsContent value="warehouses" className="mt-4">
          <DataTable
            loading={warehouses.isLoading}
            rows={warehouses.data ?? []}
            exportName="warehouses"
            searchKeys={(r: any) => `${r.name} ${r.location ?? ""}`}
            columns={[
              { key: "name", header: "Warehouse" },
              { key: "location", header: "Location" },
              { key: "is_active", header: "Active", render: (r: any) => (r.is_active ? "Yes" : "No") },
            ]}
          />
        </TabsContent>

        <TabsContent value="valuation" className="mt-4">
          <SectionCard title="Inventory valuation by warehouse (quantity x cost price)">
            <DataTable
              rows={valuationByWarehouse}
              exportName="inventory-valuation"
              columns={[
                { key: "warehouse", header: "Warehouse" },
                { key: "value", header: "Value", render: (r: any) => money(r.value), value: (r: any) => r.value },
              ]}
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="low" className="mt-4">
          <DataTable
            rows={lowStock.map((p: any) => ({ ...p, onHand: onHandByProduct.get(p.id) ?? 0 }))}
            exportName="low-stock"
            searchKeys={(r: any) => `${r.sku} ${r.name}`}
            empty="Everything is above its reorder level."
            columns={[
              { key: "sku", header: "SKU" },
              { key: "name", header: "Product" },
              { key: "onHand", header: "On hand", render: (r: any) => num(r.onHand), value: (r: any) => r.onHand },
              { key: "reorder_level", header: "Reorder level" },
            ]}
          />
        </TabsContent>
      </Tabs>

      <FormDialog
        open={productOpen}
        onOpenChange={(open) => {
          setProductOpen(open);
          if (!open) {
            setGeneratedSku("");
          }
        }}
        title={editing ? "Edit product" : "New product"}
        fields={productFields}
        initial={
          editing
            ? editing
            : { sku: generatedSku, unit: "pcs", is_active: true, reorder_level: 5 }
        }
        submitting={saveProduct.isPending}
        onSubmit={async (v) => {
          await saveProduct.mutateAsync({
            id: editing?.id,
            values: {
              sku: v.sku,
              name: v.name,
              category_id: v.category_id || null,
              brand: v.brand || null,
              model: v.model || null,
              unit: v.unit || "pcs",
              cost_price: Number(v.cost_price ?? 0),
              selling_price: Number(v.selling_price ?? 0),
              reorder_level: Number(v.reorder_level ?? 0),
              warranty_months: Number(v.warranty_months ?? 0),
              tracks_serial: !!v.tracks_serial,
              is_active: v.is_active !== false,
            },
          });
          setProductOpen(false);
          setGeneratedSku("");
        }}
      />

      <FormDialog
        open={categoryOpen}
        onOpenChange={setCategoryOpen}
        title="New category"
        fields={[
          { name: "name", label: "Name", required: true },
          { name: "description", label: "Description", type: "textarea" },
        ]}
        submitting={saveCategory.isPending}
        onSubmit={async (v) => {
          await saveCategory.mutateAsync({ values: { name: v.name, description: v.description || null } });
          setCategoryOpen(false);
        }}
      />

      <FormDialog
        open={warehouseOpen}
        onOpenChange={setWarehouseOpen}
        title="New warehouse"
        fields={[
          { name: "name", label: "Name", required: true },
          { name: "location", label: "Location" },
        ]}
        submitting={saveWarehouse.isPending}
        onSubmit={async (v) => {
          await saveWarehouse.mutateAsync({ values: { name: v.name, location: v.location || null, is_active: true } });
          setWarehouseOpen(false);
        }}
      />

      <FormDialog
        open={moveOpen !== null}
        onOpenChange={(v) => setMoveOpen(v ? moveOpen : null)}
        title={moveOpen === "in" ? "Stock in" : moveOpen === "out" ? "Stock out" : "Stock adjustment"}
        description="Every movement updates stock levels and writes an audit row."
        fields={moveFields}
        onSubmit={async (v) => {
          try {
            await applyStockMovement({
              productId: v.product_id,
              warehouseId: v.warehouse_id,
              type: moveOpen ?? "in",
              quantity: Number(v.quantity),
              referenceType: "manual",
              note: v.note,
            });
            toast.success("Stock updated");
            void qc.invalidateQueries({ queryKey: ["stock_levels"] });
            void qc.invalidateQueries({ queryKey: ["stock_movements"] });
            void qc.invalidateQueries({ queryKey: ["dashboard"] });
            setMoveOpen(null);
          } catch (e: any) {
            toast.error(e?.message ?? "Could not update stock");
          }
        }}
      />
    </div>
  );
}

function SerialsTab({
  serials,
  productOptions,
  warehouseOptions,
}: {
  serials: any;
  productOptions: { value: string; label: string }[];
  warehouseOptions: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  return (
    <>
      <div className="mb-3">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Register serial
        </Button>
      </div>
      <DataTable
        loading={serials.isLoading}
        rows={serials.data ?? []}
        exportName="serial-numbers"
        searchKeys={(r: any) => `${r.serial} ${r.products?.name ?? ""}`}
        columns={[
          { key: "serial", header: "Serial" },
          { key: "product", header: "Product", render: (r: any) => r.products?.name ?? "—", value: (r: any) => r.products?.name ?? "" },
          { key: "warehouse", header: "Warehouse", render: (r: any) => r.warehouses?.name ?? "—" },
          { key: "status", header: "Status" },
          { key: "created_at", header: "Added", render: (r: any) => dateTime(r.created_at) },
        ]}
      />
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Register serial number"
        fields={[
          { name: "product_id", label: "Product", type: "select", required: true, options: productOptions },
          { name: "warehouse_id", label: "Warehouse", type: "select", required: true, options: warehouseOptions },
          { name: "serial", label: "Serial number", required: true },
        ]}
        onSubmit={async (v) => {
          const { error } = await db
            .from("serial_numbers")
            .insert({ product_id: v.product_id, warehouse_id: v.warehouse_id, serial: v.serial, status: "available" });
          if (error) {
            toast.error(error.message);
            return;
          }
          toast.success("Serial registered");
          void qc.invalidateQueries({ queryKey: ["serial_numbers"] });
          setOpen(false);
        }}
      />
    </>
  );
}
