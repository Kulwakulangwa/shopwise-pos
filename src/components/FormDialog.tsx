/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "textarea" | "select" | "switch" | "email";
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  half?: boolean;
};

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
  initial,
  onSubmit,
  submitting,
  extra,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  fields: Field[];
  initial?: Record<string, any>;
  onSubmit: (values: Record<string, any>) => void | Promise<void>;
  submitting?: boolean;
  extra?: ReactNode;
}) {
  const [values, setValues] = useState<Record<string, any>>({});

  useEffect(() => {
    if (open) setValues(initial ? { ...initial } : {});
  }, [open, initial]);

  const set = (name: string, value: any) => setValues((v) => ({ ...v, [name]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <form
          className="grid grid-cols-2 gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            await onSubmit(values);
          }}
        >
          {fields.map((f) => (
            <div key={f.name} className={`space-y-1.5 ${f.half ? "col-span-1" : "col-span-2"}`}>
              <Label htmlFor={f.name}>{f.label}</Label>
              {f.type === "textarea" ? (
                <Textarea
                  id={f.name}
                  value={values[f.name] ?? ""}
                  required={f.required}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              ) : f.type === "select" ? (
                <Select value={values[f.name] ?? ""} onValueChange={(v) => set(f.name, v)}>
                  <SelectTrigger id={f.name}>
                    <SelectValue placeholder={f.placeholder ?? "Select..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {(f.options ?? []).map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : f.type === "switch" ? (
                <div className="flex h-9 items-center">
                  <Switch id={f.name} checked={!!values[f.name]} onCheckedChange={(v) => set(f.name, v)} />
                </div>
              ) : (
                <Input
                  id={f.name}
                  type={f.type ?? "text"}
                  step={f.type === "number" ? "0.01" : undefined}
                  required={f.required}
                  placeholder={f.placeholder}
                  value={values[f.name] ?? ""}
                  onChange={(e) => set(f.name, f.type === "number" ? e.target.value : e.target.value)}
                />
              )}
            </div>
          ))}

          {extra && <div className="col-span-2">{extra}</div>}

          <DialogFooter className="col-span-2 mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
