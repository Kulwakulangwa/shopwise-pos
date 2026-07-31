/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Shield,
  Users,
  Settings,
  Database,
  Clock,
  UserPlus,
  Trash2,
  Edit,
  Eye,
  Search,
  CheckCircle,
  XCircle,
  Download,
  Upload,
  HardDrive,
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
import { db, useRows, currentUserId, requireRole } from "@/lib/crud";
import { date, time } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/control-room")({
  beforeLoad: async () => {
    await requireRole("owner");
  },
  head: () => ({
    meta: [
      { title: "Control Room — My Shop" },
      { name: "description", content: "Owner-only system administration." },
    ],
  }),
  component: Admin,
});

// Available permissions (same as staff module)
const AVAILABLE_PERMISSIONS = [
  "dashboard.view",
  "inventory.view",
  "inventory.manage",
  "pos.view",
  "pos.sell",
  "sales.view",
  "sales.manage",
  "sales.returns",
  "customers.view",
  "customers.manage",
  "suppliers.view",
  "suppliers.manage",
  "purchasing.view",
  "purchasing.manage",
  "purchasing.receive",
  "credit.view",
  "warranty.view",
  "warranty.manage",
  "finance.view",
  "finance.manage",
  "staff.view",
  "staff.manage",
  "reports.view",
  "settings.manage",
];

function Admin() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"users" | "roles" | "settings" | "logs" | "backup">("users");
  const [search, setSearch] = useState("");
  const [processing, setProcessing] = useState(false);

  // Fetch data from the new schema (profiles + user_roles)
  const profiles = useRows("profiles", {
    order: { column: "full_name", ascending: true },
  });
  const roles = useRows("roles", {
    order: { column: "name", ascending: true },
  });
  const userRoles = useRows("user_roles");
  const settings = useRows("system_settings");
  const activityLogs = useRows("activity_logs", {
    select: "*, profiles!user_id(full_name, email)",
    order: { column: "created_at", ascending: false },
    limit: 200,
  });

  // Merge profiles with user_roles
  const usersWithRoles = useMemo(() => {
    const roleMap = new Map();
    for (const ur of (userRoles.data ?? []) as any[]) {
      roleMap.set(ur.user_id, ur.role);
    }
    return (profiles.data ?? []).map((p: any) => ({
      ...p,
      role: roleMap.get(p.id) || null,
    }));
  }, [profiles.data, userRoles.data]);

  // Filter users by search
  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return usersWithRoles;
    return usersWithRoles.filter((u: any) =>
      u.full_name.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      (u.role && u.role.toLowerCase().includes(q))
    );
  }, [usersWithRoles, search]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    const q = search.toLowerCase().trim();
    let logs = (activityLogs.data ?? []) as any[];
    if (!q) return logs;
    return logs.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        l.entity.toLowerCase().includes(q) ||
        (l.profiles?.full_name && l.profiles.full_name.toLowerCase().includes(q))
    );
  }, [activityLogs.data, search]);

  // --- Handlers ---

  // User management
  const toggleUserActive = async (userId: string, currentActive: boolean) => {
    try {
      await db
        .from("profiles")
        .update({ is_active: !currentActive })
        .eq("id", userId);
      toast.success(`User ${currentActive ? "disabled" : "enabled"}`);
      void qc.invalidateQueries({ queryKey: ["profiles"] });
    } catch (e: any) {
      toast.error(e?.message);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm("Delete this user? This cannot be undone.")) return;
    try {
      await db.from("profiles").delete().eq("id", userId);
      toast.success("User deleted");
      void qc.invalidateQueries({ queryKey: ["profiles"] });
    } catch (e: any) {
      toast.error(e?.message);
    }
  };

  const updateUserRole = async (userId: string, roleName: string) => {
    try {
      // Upsert the role
      await db
        .from("user_roles")
        .upsert({ user_id: userId, role: roleName }, { onConflict: "user_id" });
      toast.success("User role updated");
      void qc.invalidateQueries({ queryKey: ["user_roles"] });
    } catch (e: any) {
      toast.error(e?.message);
    }
  };

  // Role management
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [roleFormData, setRoleFormData] = useState<{ name: string; permissions: string[] }>({
    name: "",
    permissions: [],
  });

  const openRoleForm = (role?: any) => {
    if (role) {
      setEditingRole(role);
      setRoleFormData({
        name: role.name,
        permissions: role.permissions || [],
      });
    } else {
      setEditingRole(null);
      setRoleFormData({ name: "", permissions: [] });
    }
    setRoleDialogOpen(true);
  };

  const togglePermission = (permission: string) => {
    const current = roleFormData.permissions || [];
    if (current.includes(permission)) {
      setRoleFormData({
        ...roleFormData,
        permissions: current.filter((p) => p !== permission),
      });
    } else {
      setRoleFormData({
        ...roleFormData,
        permissions: [...current, permission],
      });
    }
  };

  const saveRole = async () => {
    if (!roleFormData.name) {
      toast.error("Role name is required");
      return;
    }
    setProcessing(true);
    try {
      if (editingRole) {
        await db
          .from("roles")
          .update({
            name: roleFormData.name,
            permissions: roleFormData.permissions,
          })
          .eq("name", editingRole.name);
        toast.success("Role updated");
      } else {
        await db.from("roles").insert({
          name: roleFormData.name,
          permissions: roleFormData.permissions,
        });
        toast.success("Role created");
      }
      setRoleDialogOpen(false);
      setEditingRole(null);
      setRoleFormData({ name: "", permissions: [] });
      void qc.invalidateQueries({ queryKey: ["roles"] });
    } catch (e: any) {
      toast.error(e?.message);
    } finally {
      setProcessing(false);
    }
  };

  const deleteRole = async (roleName: string) => {
    if (!confirm("Delete this role? Users assigned to this role will lose permissions.")) return;
    try {
      await db.from("roles").delete().eq("name", roleName);
      toast.success("Role deleted");
      void qc.invalidateQueries({ queryKey: ["roles"] });
    } catch (e: any) {
      toast.error(e?.message);
    }
  };

  // System settings
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [editingSetting, setEditingSetting] = useState<any>(null);
  const [settingValue, setSettingValue] = useState("");

  const openSettingForm = (setting: any) => {
    setEditingSetting(setting);
    setSettingValue(typeof setting.value === 'string' ? setting.value : JSON.stringify(setting.value));
    setSettingsDialogOpen(true);
  };

  const saveSetting = async () => {
    if (!editingSetting) return;
    try {
      let valueToSave = settingValue;
      // Try to parse as JSON if it looks like JSON
      if (settingValue.startsWith("{") || settingValue.startsWith("[")) {
        try {
          valueToSave = JSON.parse(settingValue);
        } catch {
          // Keep as string
        }
      }
      await db
        .from("system_settings")
        .update({ value: valueToSave })
        .eq("key", editingSetting.key);
      toast.success("Setting updated");
      setSettingsDialogOpen(false);
      setEditingSetting(null);
      setSettingValue("");
      void qc.invalidateQueries({ queryKey: ["system_settings"] });
    } catch (e: any) {
      toast.error(e?.message);
    }
  };

  // Backup & Restore (simplified)
  const exportBackup = async () => {
    toast.info("Preparing backup...");
    try {
      const tables = [
        "profiles",
        "user_roles",
        "roles",
        "customers",
        "suppliers",
        "products",
        "categories",
        "warehouses",
        "stock_levels",
        "stock_movements",
        "invoices",
        "invoice_items",
        "purchase_orders",
        "purchase_order_items",
        "goods_receipts",
        "goods_receipt_items",
        "serial_numbers",
        "warranties",
        "cash_transactions",
        "bank_accounts",
        "system_settings",
      ];
      const backup: any = {};
      for (const table of tables) {
        const { data, error } = await db.from(table).select("*");
        if (error) throw error;
        backup[table] = data;
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded");
    } catch (e: any) {
      toast.error(e?.message ?? "Backup failed");
    }
  };

  const importBackup = async (file: File) => {
    if (!confirm("This will OVERWRITE all existing data. Are you sure?")) return;
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      const tables = Object.keys(backup);
      for (const table of tables) {
        // Clear table
        await db.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (backup[table].length > 0) {
          await db.from(table).insert(backup[table]);
        }
      }
      toast.success("Restore completed");
      void qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e?.message ?? "Restore failed");
    }
  };

  const totalUsers = (profiles.data ?? []).length;
  const totalRoles = (roles.data ?? []).length;
  const totalLogs = (activityLogs.data ?? []).length;

  return (
    <div>
      <PageHeader
        title="Control Room"
        subtitle="Owner-only system administration. Manage users, roles, settings, and backups."
      >
        <Badge variant="destructive" className="ml-2">
          Owner Only
        </Badge>
      </PageHeader>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Users</p>
          <p className="text-2xl font-bold">{totalUsers}</p>
        </div>
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Roles</p>
          <p className="text-2xl font-bold">{totalRoles}</p>
        </div>
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">System Settings</p>
          <p className="text-2xl font-bold">{(settings.data ?? []).length}</p>
        </div>
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Audit Logs</p>
          <p className="text-2xl font-bold">{totalLogs}</p>
          <p className="text-xs text-muted-foreground">last 200 entries</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="users"><Users className="mr-1 size-3.5" />Users</TabsTrigger>
            <TabsTrigger value="roles"><Shield className="mr-1 size-3.5" />Roles</TabsTrigger>
            <TabsTrigger value="settings"><Settings className="mr-1 size-3.5" />Settings</TabsTrigger>
            <TabsTrigger value="logs"><Clock className="mr-1 size-3.5" />Audit Logs</TabsTrigger>
            <TabsTrigger value="backup"><HardDrive className="mr-1 size-3.5" />Backup</TabsTrigger>
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
            {activeTab === "roles" && (
              <Button size="sm" onClick={() => openRoleForm()}>
                <Shield className="mr-1 size-3.5" />
                New Role
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="users" className="mt-3">
          <AdminUserTable
            users={filteredUsers}
            roles={roles.data ?? []}
            onToggleActive={toggleUserActive}
            onDelete={deleteUser}
            onUpdateRole={updateUserRole}
          />
        </TabsContent>

        <TabsContent value="roles" className="mt-3">
          <AdminRoleTable
            roles={roles.data ?? []}
            onEdit={openRoleForm}
            onDelete={deleteRole}
          />
        </TabsContent>

        <TabsContent value="settings" className="mt-3">
          <AdminSettingsTable
            settings={settings.data ?? []}
            onEdit={openSettingForm}
          />
        </TabsContent>

        <TabsContent value="logs" className="mt-3">
          <AdminLogTable logs={filteredLogs} />
        </TabsContent>

        <TabsContent value="backup" className="mt-3">
          <AdminBackupPanel onExport={exportBackup} onImport={importBackup} />
        </TabsContent>
      </Tabs>

      {/* Role Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit Role" : "New Role"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Role Name *</Label>
              <Input
                value={roleFormData.name}
                onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value })}
                placeholder="e.g., Owner, Manager, Cashier"
              />
            </div>
            <div>
              <Label>Permissions</Label>
              <div className="max-h-64 overflow-auto rounded-md border p-3">
                <div className="grid grid-cols-2 gap-1">
                  {AVAILABLE_PERMISSIONS.map((perm) => (
                    <div key={perm} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`perm-${perm}`}
                        checked={(roleFormData.permissions || []).includes(perm)}
                        onChange={() => togglePermission(perm)}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor={`perm-${perm}`} className="text-xs cursor-pointer">
                        {perm.replace(".", " → ")}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveRole} disabled={processing}>
                {processing ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Setting: {editingSetting?.key}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Value</Label>
              <Input
                value={settingValue}
                onChange={(e) => setSettingValue(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveSetting} disabled={processing}>
                {processing ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Sub-components ---

function AdminUserTable({ users, roles, onToggleActive, onDelete, onUpdateRole }: any) {
  if (!users.length) {
    return <div className="py-8 text-center text-muted-foreground">No users found.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u: any) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">{u.full_name}</TableCell>
              <TableCell>{u.email}</TableCell>
              <TableCell>
                <Select
                  value={u.role || ""}
                  onValueChange={(v) => onUpdateRole(u.id, v)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r: any) => (
                      <SelectItem key={r.name} value={r.name}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Badge variant={u.is_active !== false ? "default" : "destructive"}>
                  {u.is_active !== false ? "Active" : "Disabled"}
                </Badge>
              </TableCell>
              <TableCell className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onToggleActive(u.id, u.is_active !== false)}
                >
                  {u.is_active !== false ? (
                    <XCircle className="size-4 text-destructive" />
                  ) : (
                    <CheckCircle className="size-4 text-green-600" />
                  )}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(u.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AdminRoleTable({ roles, onEdit, onDelete }: any) {
  if (!roles.length) {
    return <div className="py-8 text-center text-muted-foreground">No roles defined.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Role Name</TableHead>
            <TableHead>Permissions</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((r: any) => (
            <TableRow key={r.name}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {(r.permissions || []).slice(0, 5).map((p: string) => (
                    <Badge key={p} variant="outline" className="text-xs">
                      {p.replace(".", " → ")}
                    </Badge>
                  ))}
                  {(r.permissions || []).length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{(r.permissions || []).length - 5} more
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" onClick={() => onEdit(r)}>
                  <Edit className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(r.name)}>
                  <Trash2 className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AdminSettingsTable({ settings, onEdit }: any) {
  if (!settings.length) {
    return <div className="py-8 text-center text-muted-foreground">No settings found.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Key</TableHead>
            <TableHead>Value</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {settings.map((s: any) => {
            let displayValue = typeof s.value === 'string' ? s.value : JSON.stringify(s.value);
            return (
              <TableRow key={s.key}>
                <TableCell className="font-mono text-xs">{s.key}</TableCell>
                <TableCell className="max-w-xs truncate">{displayValue}</TableCell>
                <TableCell className="flex justify-end">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(s)}>
                    <Edit className="size-4" />
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

function AdminLogTable({ logs }: any) {
  if (!logs.length) {
    return <div className="py-8 text-center text-muted-foreground">No audit logs found.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Entity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log: any) => (
            <TableRow key={log.id}>
              <TableCell className="whitespace-nowrap text-xs">
                {time(log.created_at)}
              </TableCell>
              <TableCell>{log.profiles?.full_name || log.user_id}</TableCell>
              <TableCell>
                <Badge variant={log.action === "delete" ? "destructive" : "outline"} className="capitalize">
                  {log.action}
                </Badge>
              </TableCell>
              <TableCell>{log.entity}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AdminBackupPanel({ onExport, onImport }: any) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleImport = () => {
    if (!selectedFile) {
      toast.error("Select a backup file");
      return;
    }
    onImport(selectedFile);
    setSelectedFile(null);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="tile p-4">
        <h3 className="font-semibold">Export Backup</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Download a full JSON backup of all data including users, products, sales, and settings.
        </p>
        <Button className="mt-3" onClick={onExport}>
          <Download className="mr-1 size-3.5" />
          Download Backup
        </Button>
      </div>
      <div className="tile p-4">
        <h3 className="font-semibold">Restore Backup</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a backup JSON file to restore all data. <strong>This will overwrite current data.</strong>
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Input
            type="file"
            accept=".json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setSelectedFile(file);
            }}
          />
          <Button variant="destructive" onClick={handleImport} disabled={!selectedFile}>
            <Upload className="mr-1 size-3.5" />
            Restore
          </Button>
        </div>
        {selectedFile && (
          <p className="mt-1 text-xs text-muted-foreground">
            Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
          </p>
        )}
      </div>
    </div>
  );
}
