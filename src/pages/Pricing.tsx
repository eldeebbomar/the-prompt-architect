import { Check, Minus } from "lucide-react";
import PricingSection from "@/components/PricingSection";
import CtaFooter from "@/components/CtaFooter";
import ScrollReveal from "@/components/ScrollReveal";

const comparisonRows = [
  {
    feature: "AI Discovery Interview",
    free: "1",
    single: "1",
    pack: "5",
    unlimited: "Unlimited",
  },
  {
    feature: "Prompts per Project",
    free: "50+",
    single: "50+",
    pack: "50+",
    unlimited: "50+",
  },
  {
    feature: "Revisions per Project",
    free: "1",
    single: "2",
    pack: "2",
    unlimited: "Unlimited",
  },
  { feature: "Loop Prompts", free: true, single: true, pack: true, unlimited: true },
  { feature: "Prompt Editing", free: true, single: true, pack: true, unlimited: true },
  {
    feature: "Export Formats",
    free: "Copy",
    single: "Copy + MD",
    pack: "Copy + MD",
    unlimited: "Copy + MD + API",
  },
  { feature: "Priority Generation", free: false, single: false, pack: true, unlimited: true },
  {
    feature: "Email Support",
    free: false,
    single: true,
    pack: true,
    unlimited: "Priority",
  },
];

const CellValue = ({ value }: { value: boolean | string }) => {
  if (value === true) return <Check className="mx-auto h-4 w-4 text-secondary" />;
  if (value === false) return <Minus className="mx-auto h-4 w-4 text-destructive/60" />;
  return (
    <span className="font-body text-sm text-foreground">{value}</span>
  );
};

const Pricing = () => (
  <div>
    <SEO title="Pricing" description="Choose a plan for your LovPlan AI prompt blueprints. Every credit includes a full AI discovery session, 50+ structured prompts, revisions, and loop prompts." />
    <section className="container pt-32 pb-8 text-center">
      <ScrollReveal>
        <h1 className="font-heading text-[36px] leading-[1.1] text-foreground md:text-[44px]">
          Invest in your build
        </h1>
        <p className="mx-auto mt-5 max-w-xl font-body text-sm font-light leading-relaxed text-muted-foreground">
          Every credit includes a full AI discovery session, 50+ structured
          prompts, revisions, and loop prompts.
        </p>
      </ScrollReveal>
    </section>

    {/* Pricing cards (reused component) */}
    <PricingSection />

    {/* Comparison table */}
    <section className="container pb-24">
      <ScrollReveal className="mx-auto max-w-4xl">
        <h2 className="mb-10 text-center font-heading text-2xl text-foreground">
          Compare plans
        </h2>

        <div className="overflow-x-auto rounded-card border border-border">
          <table className="w-full min-w-[600px] text-left">
            <thead>
              <tr className="bg-primary/10">
                <th className="px-5 py-3.5 font-body text-xs font-semibold uppercase tracking-wider text-primary">
                  Feature
                </th>
                {["Free", "Single", "5-Pack", "Unlimited"].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3.5 text-center font-body text-xs font-semibold uppercase tracking-wider text-primary"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, i) => (
                <tr
                  key={row.feature}
                  className={`border-t border-border ${
                    i % 2 === 0 ? "bg-card" : "bg-[hsl(var(--surface-elevated))]"
                  }`}
                >
                  <td className="px-5 py-3.5 font-body text-sm text-foreground">
                    {row.feature}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <CellValue value={row.free} />
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <CellValue value={row.single} />
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <CellValue value={row.pack} />
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <CellValue value={row.unlimited} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ScrollReveal>
    </section>

    <CtaFooter />
  </div>
);

export default Pricing;
