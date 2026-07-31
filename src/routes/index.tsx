// src/routes/_authenticated/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

function Dashboard() {
  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Welcome back to My Shop" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-4">
        <div className="tile p-4">
          <p className="text-xs uppercase text-muted-foreground">Total Sales</p>
          <p className="text-2xl font-bold">TZS 0</p>
        </div>
        <div className="tile p-4">
          <p className="text-xs uppercase text-muted-foreground">Products</p>
          <p className="text-2xl font-bold">0</p>
        </div>
        <div className="tile p-4">
          <p className="text-xs uppercase text-muted-foreground">Low Stock</p>
          <p className="text-2xl font-bold text-destructive">0</p>
        </div>
        <div className="tile p-4">
          <p className="text-xs uppercase text-muted-foreground">Outstanding</p>
          <p className="text-2xl font-bold text-amber-600">TZS 0</p>
        </div>
      </div>
    </div>
  );
}
