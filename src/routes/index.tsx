import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Boxes, CreditCard, ScanLine, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "My Shop — Wholesale Electronics Inventory & POS" },
      {
        name: "description",
        content:
          "Internal operations system for My Shop: multi-warehouse inventory, point of sale, credit control, warranties, purchasing and finance for wholesale electronics.",
      },
      { property: "og:title", content: "My Shop — Wholesale Electronics Inventory & POS" },
      {
        property: "og:description",
        content: "Inventory, POS, credit, warranty and finance in one internal operations system.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const HIGHLIGHTS = [
  { icon: Boxes, title: "Multi-warehouse stock", body: "Live stock levels, movements, adjustments and serial tracking." },
  { icon: ScanLine, title: "Fast counter checkout", body: "Keyboard-driven POS with serial selection and credit checks." },
  { icon: CreditCard, title: "Credit & debt control", body: "Limits, statements, payments and 0–90+ day aging." },
  { icon: ShieldCheck, title: "Warranty workflow", body: "Auto-registered warranties and claim tracking to resolution." },
];

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
            MS
          </span>
          <span className="font-semibold">My Shop</span>
        </div>
        <Button asChild size="sm">
          <Link to="/auth">Staff sign in</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-20">
        <section className="py-14">
          <p className="text-xs font-medium uppercase tracking-widest text-accent-foreground">Internal operations</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight md:text-5xl">
            Run the whole electronics business from one screen.
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground">
            TVs, ACs, refrigerators and washing machines — from goods receiving to counter sale, credit ledger and
            profit report. All amounts in TZS.
          </p>
          <Button asChild size="lg" className="mt-7">
            <Link to="/auth">Open the system</Link>
          </Button>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {HIGHLIGHTS.map((h) => (
            <div key={h.title} className="tile p-5">
              <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <h.icon className="size-4" />
              </span>
              <h2 className="mt-3 text-base font-semibold">{h.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{h.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
