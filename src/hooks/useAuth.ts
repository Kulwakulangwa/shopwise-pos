import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "owner" | "manager" | "cashier" | "storekeeper";

export type Module =
  | "dashboard"
  | "inventory"
  | "sales"
  | "pos"
  | "customers"
  | "suppliers"
  | "purchasing"
  | "credit"
  | "warranty"
  | "finance"
  | "staff"
  | "reports"
  | "admin";

const ACCESS: Record<AppRole, Module[]> = {
  owner: [
    "dashboard",
    "inventory",
    "sales",
    "pos",
    "customers",
    "suppliers",
    "purchasing",
    "credit",
    "warranty",
    "finance",
    "staff",
    "reports",
    "admin",
  ],
  manager: [
    "dashboard",
    "inventory",
    "sales",
    "pos",
    "customers",
    "suppliers",
    "purchasing",
    "credit",
    "warranty",
    "reports",
  ],
  cashier: ["dashboard", "pos", "sales", "inventory", "customers"],
  storekeeper: ["dashboard", "inventory", "purchasing", "warranty"],
};

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [fullName, setFullName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async (s: Session | null) => {
      if (!active) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        const [{ data: roleRow }, { data: profile }] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", s.user.id).limit(1).maybeSingle(),
          supabase.from("profiles").select("full_name").eq("id", s.user.id).maybeSingle(),
        ]);
        if (!active) return;
        setRole(((roleRow?.role as AppRole) ?? null) as AppRole | null);
        setFullName(profile?.full_name || s.user.email || "");
      } else {
        setRole(null);
        setFullName("");
      }
      setLoading(false);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void load(s);
      }
    });

    void supabase.auth.getSession().then(({ data }) => load(data.session));

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const can = (m: Module) => (role ? ACCESS[role].includes(m) : false);

  return { session, user, role, fullName, loading, can, isOwner: role === "owner" };
}

export function roleModules(role: AppRole | null): Module[] {
  return role ? ACCESS[role] : [];
}
