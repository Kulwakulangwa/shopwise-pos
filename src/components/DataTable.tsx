import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { downloadCSV } from "@/lib/format";

export type Column<T> = {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  value?: (row: T) => string | number;
  className?: string;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  searchKeys?: (row: T) => string;
  pageSize?: number;
  empty?: string;
  exportName?: string;
  toolbar?: ReactNode;
  onRowClick?: (row: T) => void;
};

export function DataTable<T extends { id?: string }>({
  columns,
  rows,
  loading,
  searchKeys,
  pageSize = 10,
  empty = "Nothing here yet.",
  exportName,
  toolbar,
  onRowClick,
}: Props<T>) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!q.trim() || !searchKeys) return rows;
    const needle = q.toLowerCase();
    return rows.filter((r) => searchKeys(r).toLowerCase().includes(needle));
  }, [rows, q, searchKeys]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const slice = filtered.slice(current * pageSize, current * pageSize + pageSize);

  return (
    <div className="tile overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        {searchKeys && (
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder="Search..."
              className="pl-9"
            />
          </div>
        )}
        {toolbar}
        {exportName && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadCSV(
                exportName,
                filtered.map((r) =>
                  Object.fromEntries(
                    columns.map((c) => [c.header, c.value ? c.value(r) : String((r as never)[c.key] ?? "")]),
                  ),
                ),
              )
            }
          >
            <Download className="size-4" /> CSV
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              {columns.map((c) => (
                <th key={c.key} className={`px-4 py-2.5 font-medium text-muted-foreground ${c.className ?? ""}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && slice.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-muted-foreground">
                  {empty}
                </td>
              </tr>
            )}
            {!loading &&
              slice.map((row, i) => (
                <tr
                  key={row.id ?? i}
                  onClick={() => onRowClick?.(row)}
                  className={`border-b border-border/60 last:border-0 ${onRowClick ? "cursor-pointer" : ""} hover:bg-muted/40`}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-2.5 ${c.className ?? ""}`}>
                      {c.render ? c.render(row) : String((row as never)[c.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
        <span>
          {filtered.length} record{filtered.length === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-2">
          <span>
            Page {current + 1} of {pages}
          </span>
          <Button variant="outline" size="icon" className="size-7" disabled={current === 0} onClick={() => setPage(current - 1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            disabled={current >= pages - 1}
            onClick={() => setPage(current + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
