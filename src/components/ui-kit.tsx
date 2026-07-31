import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: "default" | "success" | "warning" | "destructive" | "primary";
}) {
  const toneRing: Record<string, string> = {
    default: "bg-muted text-muted-foreground",
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning-foreground",
    destructive: "bg-destructive/10 text-destructive",
  };
  return (
    <div className="tile p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="num mt-2 truncate text-2xl font-semibold text-foreground">{value}</p>
          {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
        {icon && <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${toneRing[tone]}`}>{icon}</span>}
      </div>
    </div>
  );
}

export function SectionCard({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`tile ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-success/10 text-success",
    completed: "bg-success/10 text-success",
    received: "bg-success/10 text-success",
    approved: "bg-success/10 text-success",
    resolved: "bg-success/10 text-success",
    active: "bg-success/10 text-success",
    accepted: "bg-success/10 text-success",
    pending: "bg-warning/15 text-warning-foreground",
    draft: "bg-muted text-muted-foreground",
    sent: "bg-primary/10 text-primary",
    open: "bg-primary/10 text-primary",
    in_service: "bg-primary/10 text-primary",
    partially_paid: "bg-warning/15 text-warning-foreground",
    partially_received: "bg-warning/15 text-warning-foreground",
    unpaid: "bg-destructive/10 text-destructive",
    cancelled: "bg-destructive/10 text-destructive",
    rejected: "bg-destructive/10 text-destructive",
    expired: "bg-destructive/10 text-destructive",
    void: "bg-destructive/10 text-destructive",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${map[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
