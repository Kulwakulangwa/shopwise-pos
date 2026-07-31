/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Users,
  User,
  UserPlus,
  Search,
  Eye,
  Edit,
  Trash2,
  Shield,
  Key,
  Clock,
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle,
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
import { Switch } from "@/components/ui/switch";
import { db, useRows, currentUserId } from "@/lib/crud";
import { money, date, time } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({
    meta: [
      { title: "Staff Management — My Shop" },
      { name: "description", content: "Manage employees, roles, permissions, and activity logs." },
    ],
  }),
  component: StaffManagement,
});

type Employee = {
  id: string;
  email: string;
  full_name: string;
  role_id: string;
  is_active: boolean;
  last_sign_in_at?: string;
  created_at: string;
  roles?: { name: string };
};

type Role = {
  id: string;
  name: string;
  permissions: string[];
  created_at: string;
};

type ActivityLog = {
  id: string;
  user_id: string;
  action: string;
  table_name: string;
  record_id: string;
  old_data?: any;
  new_data?: any;
  created_at: string;
  users?: { full_name: string; email: string };
};

function StaffManagement() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState<Partial<Employee>>({});
  const [roleFormOpen, setRoleFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleFormData, setRoleFormData] = useState<Partial<Role>>({});
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<"employees" | "roles" | "logs">("employees");

  // Fetch data
  const employees = useRows("users", {
    select: "*, roles(name)",
    order: { column: "full_name", ascending: true },
  });
  const roles = useRows("roles", {
    order: { column: "name", ascending: true },
  });
  const activityLogs = useRows("activity_logs", {
    select: "*, users(full_name, email)",
    order: { column: "created_at", ascending: false },
    limit: 100,
  });

  // Filter employees by search
  const filteredEmployees = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return employees.data ?? [];
    return (employees.data ?? []).filter((e: any) =>
      e.full_name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      (e.roles?.name && e.roles.name.toLowerCase().includes(q))
    );
  }, [employees.data, search]);

  // Filter logs by search
  const filteredLogs = useMemo(() => {
    const q = search.toLowerCase().trim();
    let logs = (activityLogs.data ?? []) as ActivityLog[];
    if (!q) return logs;
    return logs.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        l.table_name.toLowerCase().includes(q) ||
        (l.users?.full_name && l.users.full_name.toLowerCase().includes(q)) ||
        (l.users?.email && l.users.email.toLowerCase().includes(q)) ||
        l.record_id.toLowerCase().includes(q)
    );
  }, [activityLogs.data, search]);

  // Summary stats
  const totalEmployees = (employees.data ?? []).length;
  const activeEmployees = (employees.data ?? []).filter((e: any) => e.is_active).length;
  const totalRoles = (roles.data ?? []).length;

  // Handlers for employees
  const openEmployeeForm = (employee?: Employee) => {
    if (employee) {
      setEditingEmployee(employee);
      setFormData({
        email: employee.email,
        full_name: employee.full_name,
        role_id: employee.role_id,
        is_active: employee.is_active,
      });
    } else {
      setEditingEmployee(null);
      setFormData({
        email: "",
        full_name: "",
        role_id: "",
        is_active: true,
      });
    }
    setFormOpen(true);
  };

  const saveEmployee = async () => {
    if (!formData.email || !formData.full_name) {
      toast.error("Email and full name are required");
      return;
    }
    if (!formData.role_id) {
      toast.error("Please select a role");
      return;
    }
    setProcessing(true);
    try {
      if (editingEmployee) {
        // Update employee
        await db
          .from("users")
          .update({
            full_name: formData.full_name,
            role_id: formData.role_id,
            is_active: formData.is_active,
          })
          .eq("id", editingEmployee.id);
        toast.success("Employee updated");
      } else {
        // Create employee - we need to create auth user first via Supabase
        // This is a simplified version – in production you'd use `supabase.auth.signUp()`.
        // For now, we'll insert into users table directly (assuming auth is already set up).
        // Actually, we should use the auth API. Let's use the admin API.
        // We'll assume we're using Supabase's admin client for user creation.
        // Or we can use a server function. For simplicity, we'll just insert into users table.
        // Note: This is not the full flow, but we'll implement it as a placeholder.
        toast.error("Employee creation via UI is not fully implemented. Please use Supabase Auth Admin.");
        // We could implement a server function here.
        setProcessing(false);
        return;
        // For a real implementation, we would call:
        // const { data, error } = await supabase.auth.admin.createUser({ email, password, user_metadata: { full_name } })
        // Then insert into users table.
      }
      setFormOpen(false);
      setEditingEmployee(null);
      setFormData({});
      void qc.invalidateQueries({ queryKey: ["users"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save employee");
    } finally {
      setProcessing(false);
    }
  };

  const deleteEmployee = async (id: string) => {
    if (!confirm("Delete this employee? This cannot be undone.")) return;
    try {
      // In production, you'd also delete from auth
      await db.from("users").delete().eq("id", id);
      toast.success("Employee deleted");
      void qc.invalidateQueries({ queryKey: ["users"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed");
    }
  };

  // Handlers for roles
  const openRoleForm = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      setRoleFormData({
        name: role.name,
        permissions: role.permissions,
      });
    } else {
      setEditingRole(null);
      setRoleFormData({
        name: "",
        permissions: [],
      });
    }
    setRoleFormOpen(true);
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
            permissions: roleFormData.permissions || [],
          })
          .eq("id", editingRole.id);
        toast.success("Role updated");
      } else {
        await db.from("roles").insert({
          name: roleFormData.name,
          permissions: roleFormData.permissions || [],
        });
        toast.success("Role created");
      }
      setRoleFormOpen(false);
      setEditingRole(null);
      setRoleFormData({});
      void qc.invalidateQueries({ queryKey: ["roles"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save role");
    } finally {
      setProcessing(false);
    }
  };

  const deleteRole = async (id: string) => {
    if (!confirm("Delete this role? This cannot be undone.")) return;
    try {
      await db.from("roles").delete().eq("id", id);
      toast.success("Role deleted");
      void qc.invalidateQueries({ queryKey: ["roles"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed");
    }
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

  // Available permissions list (hardcoded based on your modules)
  const availablePermissions = [
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

  return (
    <div>
      <PageHeader
        title="Staff Management"
        subtitle="Manage employees, roles, permissions, and view activity logs."
      />

      {/* Summary Cards */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Total Employees</p>
          <p className="text-2xl font-bold">{totalEmployees}</p>
          <p className="text-xs text-green-600">{activeEmployees} active</p>
        </div>
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Roles</p>
          <p className="text-2xl font-bold">{totalRoles}</p>
        </div>
        <div className="tile p-3">
          <p className="text-xs uppercase text-muted-foreground">Recent Activity</p>
          <p className="text-2xl font-bold">{(activityLogs.data ?? []).length}</p>
          <p className="text-xs text-muted-foreground">last 100 entries</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="employees">Employees</TabsTrigger>
            <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
            <TabsTrigger value="logs">Activity Logs</TabsTrigger>
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
            {activeTab === "employees" && (
              <Button size="sm" onClick={() => openEmployeeForm()}>
                <UserPlus className="mr-1 size-3.5" />
                Add Employee
              </Button>
            )}
            {activeTab === "roles" && (
              <Button size="sm" onClick={() => openRoleForm()}>
                <Shield className="mr-1 size-3.5" />
                New Role
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="employees" className="mt-3">
          <EmployeeTable
            employees={filteredEmployees}
            onView={(e) => {
              setSelectedEmployee(e);
              setDetailOpen(true);
            }}
            onEdit={openEmployeeForm}
            onDelete={deleteEmployee}
          />
        </TabsContent>

        <TabsContent value="roles" className="mt-3">
          <RoleTable
            roles={roles.data ?? []}
            onEdit={openRoleForm}
            onDelete={deleteRole}
          />
        </TabsContent>

        <TabsContent value="logs" className="mt-3">
          <LogTable logs={filteredLogs} />
        </TabsContent>
      </Tabs>

      {/* Employee Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedEmployee?.full_name}</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p>{selectedEmployee.email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Role</p>
                  <p>{selectedEmployee.roles?.name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={selectedEmployee.is_active ? "default" : "destructive"}>
                    {selectedEmployee.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Last Sign In</p>
                  <p>{selectedEmployee.last_sign_in_at ? date(selectedEmployee.last_sign_in_at) : "Never"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Member Since</p>
                  <p>{date(selectedEmployee.created_at)}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Recent Activity</p>
                <div className="max-h-48 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Table</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(activityLogs.data ?? [])
                        .filter((log: any) => log.user_id === selectedEmployee.id)
                        .slice(0, 10)
                        .map((log: any) => (
                          <TableRow key={log.id}>
                            <TableCell className="whitespace-nowrap text-xs">
                              {time(log.created_at)}
                            </TableCell>
                            <TableCell className="capitalize">{log.action}</TableCell>
                            <TableCell>{log.table_name}</TableCell>
                          </TableRow>
                        ))}
                      {(!activityLogs.data ||
                        (activityLogs.data ?? []).filter((log: any) => log.user_id === selectedEmployee.id)
                          .length === 0) && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            No activity recorded
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Employee Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEmployee ? "Edit Employee" : "Add Employee"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Full Name *</Label>
              <Input
                value={formData.full_name || ""}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={formData.email || ""}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={!!editingEmployee} // Email can't be changed easily
              />
            </div>
            <div>
              <Label>Role *</Label>
              <Select
                value={formData.role_id || ""}
                onValueChange={(v) => setFormData({ ...formData, role_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {(roles.data ?? []).map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editingEmployee && (
              <div className="flex items-center gap-2">
                <Switch
                  id="active"
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                />
                <Label htmlFor="active">Active</Label>
              </div>
            )}
            {!editingEmployee && (
              <div className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
                Note: New employees need to be created via Supabase Auth Admin. This is a simplified UI.
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button onClick={saveEmployee} disabled={processing}>
                {processing ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Role Form Dialog */}
      <Dialog open={roleFormOpen} onOpenChange={setRoleFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit Role" : "New Role"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Role Name *</Label>
              <Input
                value={roleFormData.name || ""}
                onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value })}
                placeholder="e.g., Manager, Cashier"
              />
            </div>
            <div>
              <Label>Permissions</Label>
              <div className="max-h-64 overflow-auto rounded-md border p-3">
                <div className="grid grid-cols-2 gap-1">
                  {availablePermissions.map((perm) => (
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
              <Button variant="outline" onClick={() => setRoleFormOpen(false)}>Cancel</Button>
              <Button onClick={saveRole} disabled={processing}>
                {processing ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Table components
function EmployeeTable({ employees, onView, onEdit, onDelete }: any) {
  if (!employees.length) {
    return <div className="py-8 text-center text-muted-foreground">No employees found.</div>;
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
            <TableHead>Last Active</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((e: any) => (
            <TableRow key={e.id}>
              <TableCell className="font-medium">{e.full_name}</TableCell>
              <TableCell>{e.email}</TableCell>
              <TableCell>{e.roles?.name || "—"}</TableCell>
              <TableCell>
                <Badge variant={e.is_active ? "default" : "destructive"}>
                  {e.is_active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell>{e.last_sign_in_at ? date(e.last_sign_in_at) : "Never"}</TableCell>
              <TableCell className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" onClick={() => onView(e)}>
                  <Eye className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onEdit(e)}>
                  <Edit className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(e.id)}>
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

function RoleTable({ roles, onEdit, onDelete }: any) {
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
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((r: any) => (
            <TableRow key={r.id}>
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
              <TableCell>{date(r.created_at)}</TableCell>
              <TableCell className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" onClick={() => onEdit(r)}>
                  <Edit className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(r.id)}>
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

function LogTable({ logs }: any) {
  if (!logs.length) {
    return <div className="py-8 text-center text-muted-foreground">No activity logs found.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Table</TableHead>
            <TableHead>Record ID</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log: any) => (
            <TableRow key={log.id}>
              <TableCell className="whitespace-nowrap text-xs">
                {time(log.created_at)}
              </TableCell>
              <TableCell>{log.users?.full_name || log.user_id}</TableCell>
              <TableCell>
                <Badge variant={log.action === "delete" ? "destructive" : "outline"} className="capitalize">
                  {log.action}
                </Badge>
              </TableCell>
              <TableCell>{log.table_name}</TableCell>
              <TableCell className="font-mono text-xs">{log.record_id.slice(0, 8)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
