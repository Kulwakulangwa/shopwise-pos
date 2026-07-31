import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Boxes,
  ShoppingCart,
  Users,
  Truck,
  ClipboardList,
  CreditCard,
  ShieldCheck,
  Wallet,
  UserCog,
  BarChart3,
  Lock,
  ScanLine,
  LogOut,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type Module } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

type Item = { title: string; url: string; icon: typeof Boxes; module: Module };

const GROUPS: { label: string; items: Item[] }[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, module: "dashboard" },
      { title: "Point of Sale", url: "/pos", icon: ScanLine, module: "pos" },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Inventory", url: "/inventory", icon: Boxes, module: "inventory" },
      { title: "Sales", url: "/sales", icon: ShoppingCart, module: "sales" },
      { title: "Purchasing", url: "/purchasing", icon: ClipboardList, module: "purchasing" },
      { title: "Warranty", url: "/warranty", icon: ShieldCheck, module: "warranty" },
    ],
  },
  {
    label: "Relationships",
    items: [
      { title: "Customers", url: "/customers", icon: Users, module: "customers" },
      { title: "Suppliers", url: "/suppliers", icon: Truck, module: "suppliers" },
      { title: "Credit & Debts", url: "/credit", icon: CreditCard, module: "credit" },
    ],
  },
  {
    label: "Back office",
    items: [
      { title: "Finance", url: "/finance", icon: Wallet, module: "finance" },
      { title: "Staff", url: "/staff", icon: UserCog, module: "staff" },
      { title: "Reports", url: "/reports", icon: BarChart3, module: "reports" },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { can, role, fullName, isOwner } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
            MS
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-sidebar-foreground">My Shop</p>
              <p className="truncate text-[11px] text-sidebar-foreground/60">Electronics operations</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {GROUPS.map((group) => {
          const items = group.items.filter((i) => can(i.module));
          if (!items.length) return null;
          return (
            <SidebarGroup key={group.label}>
              {!collapsed && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={pathname.startsWith(item.url)} tooltip={item.title}>
                        <Link to={item.url} className="flex items-center gap-2">
                          <item.icon className="size-4 shrink-0" />
                          {!collapsed && <span>{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}

        {isOwner && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel>Restricted</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith("/control-room")} tooltip="Control Room">
                    <Link to="/control-room" className="flex items-center gap-2">
                      <Lock className="size-4 shrink-0" />
                      {!collapsed && <span>Control Room</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
            {(fullName || "?").slice(0, 1).toUpperCase()}
          </span>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-sidebar-foreground">{fullName || "Staff"}</p>
              <p className="truncate text-[11px] capitalize text-sidebar-foreground/60">{role ?? "—"}</p>
            </div>
          )}
          <button
            onClick={signOut}
            aria-label="Sign out"
            className="rounded-md p-1.5 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
