/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// The generated Database types do not yet describe the operations schema, so we
// use a loosely typed client for the business tables.
export const db = supabase as unknown as {
  from: (table: string) => any;
  auth: typeof supabase.auth;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

export type Row = Record<string, any>;

export function useRows<T = Row>(
  table: string,
  options: { select?: string; order?: { column: string; ascending?: boolean }; filters?: [string, any][]; enabled?: boolean } = {},
) {
  const { select = "*", order, filters = [], enabled = true } = options;
  return useQuery<T[]>({
    queryKey: [table, select, order, filters],
    enabled,
    queryFn: async () => {
      let q = db.from(table).select(select);
      for (const [col, val] of filters) q = q.eq(col, val);
      if (order) q = q.order(order.column, { ascending: order.ascending ?? false });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function logActivity(action: string, entity: string, entityId?: string, details: Row = {}) {
  const userId = await currentUserId();
  if (!userId) return;
  await db.from("activity_logs").insert({ user_id: userId, action, entity, entity_id: entityId ?? null, details });
}

export function useSaveRow(table: string, invalidate: string[] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: Row }) => {
      if (id) {
        const { error } = await db.from(table).update(values).eq("id", id);
        if (error) throw error;
        await logActivity("update", table, id, values);
        return id;
      }
      const { data, error } = await db.from(table).insert(values).select("id").single();
      if (error) throw error;
      await logActivity("create", table, data?.id, values);
      return data?.id as string;
    },
    onSuccess: () => {
      toast.success("Saved");
      for (const key of [table, ...invalidate]) void qc.invalidateQueries({ queryKey: [key] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save"),
  });
}

export function useDeleteRow(table: string, invalidate: string[] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from(table).delete().eq("id", id);
      if (error) throw error;
      await logActivity("delete", table, id);
    },
    onSuccess: () => {
      toast.success("Deleted");
      for (const key of [table, ...invalidate]) void qc.invalidateQueries({ queryKey: [key] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not delete"),
  });
}

/** Applies a stock change and always writes a stock_movements audit row. */
export async function applyStockMovement(params: {
  productId: string;
  warehouseId: string;
  type: "in" | "out" | "adjustment";
  quantity: number; // positive for in, positive for out (subtracted), signed for adjustment
  referenceType?: string;
  referenceId?: string;
  note?: string;
}) {
  const { productId, warehouseId, type, quantity, referenceType, referenceId, note } = params;
  const delta = type === "in" ? Math.abs(quantity) : type === "out" ? -Math.abs(quantity) : quantity;

  const { data: existing } = await db
    .from("stock_levels")
    .select("id, quantity")
    .eq("product_id", productId)
    .eq("warehouse_id", warehouseId)
    .maybeSingle();

  if (existing) {
    const { error } = await db
      .from("stock_levels")
      .update({ quantity: Number(existing.quantity) + delta, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await db
      .from("stock_levels")
      .insert({ product_id: productId, warehouse_id: warehouseId, quantity: delta });
    if (error) throw error;
  }

  const userId = await currentUserId();
  const { error: mErr } = await db.from("stock_movements").insert({
    product_id: productId,
    warehouse_id: warehouseId,
    movement_type: type,
    quantity: delta,
    reference_type: referenceType ?? null,
    reference_id: referenceId ?? null,
    note: note ?? null,
    created_by: userId,
  });
  if (mErr) throw mErr;
}

export async function recordCash(params: {
  bankAccountId?: string | null;
  direction: "in" | "out";
  amount: number;
  description: string;
  referenceType?: string;
  referenceId?: string;
}) {
  const userId = await currentUserId();
  await db.from("cash_transactions").insert({
    bank_account_id: params.bankAccountId ?? null,
    direction: params.direction,
    amount: params.amount,
    description: params.description,
    reference_type: params.referenceType ?? null,
    reference_id: params.referenceId ?? null,
    created_by: userId,
  });
  if (params.bankAccountId) {
    const { data: acct } = await db
      .from("bank_accounts")
      .select("id, current_balance")
      .eq("id", params.bankAccountId)
      .maybeSingle();
    if (acct) {
      const next = Number(acct.current_balance) + (params.direction === "in" ? params.amount : -params.amount);
      await db.from("bank_accounts").update({ current_balance: next }).eq("id", acct.id);
    }
  }
}
