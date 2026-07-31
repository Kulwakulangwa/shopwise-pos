export const TZS = new Intl.NumberFormat("en-TZ", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function money(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return `TZS ${TZS.format(Number.isFinite(n) ? n : 0)}`;
}

export function num(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("en-TZ").format(Number.isFinite(n) ? n : 0);
}

export function dateOnly(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ===== ADD THESE TWO =====
export const date = dateOnly;

export function time(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
// ===== END ADD =====

export function docNumber(prefix: string): string {
  const d = new Date();
  const stamp =
    `${d.getFullYear()}`.slice(2) +
    `${d.getMonth() + 1}`.padStart(2, "0") +
    `${d.getDate()}`.padStart(2, "0") +
    "-" +
    Math.floor(Math.random() * 9000 + 1000);
  return `${prefix}-${stamp}`;
}

export function daysBetween(from: string, to = new Date().toISOString()): number {
  return Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 86400000);
}

export function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0] ?? {});
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
}

export function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  const blob = new Blob([toCSV(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
