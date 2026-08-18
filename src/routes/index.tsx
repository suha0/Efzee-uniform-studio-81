import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Factory, ShieldCheck, Truck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Uniform Studio 81 — Uniform Order & Production Management" },
      {
        name: "description",
        content:
          "Run uniform manufacturing end to end: sales orders, production stages, quality inspection, alterations and delivery in one secure system.",
      },
      { property: "og:title", content: "Uniform Studio 81 — Order Management System" },
      {
        property: "og:description",
        content:
          "Centralised uniform order management: production tracking, quality control, alterations and delivery.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) void navigate({ to: "/dashboard", replace: true });
  }, [loading, session, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <Brand />
        <Button asChild size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <main>
        <section className="mx-auto max-w-5xl px-6 py-20 text-center">
          <p className="label-caps">Uniform manufacturing operations</p>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl leading-tight font-bold sm:text-5xl">
            Every order, every stitch, tracked from enquiry to delivery.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-muted-foreground">
            Uniform Studio 81 replaces registers, spreadsheets and scattered chat updates with a
            single production floor system for sales, production and quality teams.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/auth">
                Open the studio <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        <section className="border-t bg-card">
          <div className="mx-auto grid max-w-5xl gap-8 px-6 py-16 sm:grid-cols-3">
            {[
              {
                icon: Factory,
                title: "Production pipeline",
                body: "Fabric procurement, cutting, stitching, embroidery and packing with live progress and blockers.",
              },
              {
                icon: ShieldCheck,
                title: "Quality & alterations",
                body: "Record inspections, pass/fail quantities and route failures straight into alteration jobs.",
              },
              {
                icon: Truck,
                title: "Delivery visibility",
                body: "Deadlines, overdue alerts and delivery status the sales team can trust when the customer calls.",
              },
            ].map((feature) => (
              <div key={feature.title}>
                <feature.icon className="h-6 w-6 text-accent" />
                <h2 className="mt-3 text-base font-semibold">{feature.title}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t px-6 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Uniform Studio 81
      </footer>
    </div>
  );
}
