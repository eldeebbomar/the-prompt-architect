import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import ScrollReveal from "@/components/ScrollReveal";

const faqs = [
  {
    q: "What exactly does LovPlan generate?",
    a: "LovPlan generates 50+ structured prompts that you copy-paste into Lovable's chat or queue feature. Each prompt is a complete instruction — covering design systems, database schemas, authentication, individual pages, backend logic, and polish. They're ordered by dependency so everything builds correctly.",
  },
  {
    q: "How is this different from just asking ChatGPT for prompts?",
    a: "ChatGPT gives you generic, disconnected prompts with no context of what came before. LovPlan's AI architect conducts a deep interview about YOUR specific idea, then generates prompts that reference each other, share a consistent design system, and follow the exact dependency order that works on Lovable.",
  },
  {
    q: "What happens during the AI discovery conversation?",
    a: "Our AI architect asks you structured questions across 5 phases: your elevator pitch, target users, core features and user flows, technical preferences (dark mode, auth method, payment system), and MVP priorities. It takes about 5-10 minutes and digs deep into the details.",
  },
  {
    q: "Can I change my mind after prompts are generated?",
    a: "Absolutely. Use the revision feature to describe what changed. LovPlan regenerates only the affected prompts while keeping your infrastructure stable. You get up to 2 revisions per project (unlimited for Pro subscribers).",
  },
  {
    q: "What are loop prompts?",
    a: "Loop prompts are special audit prompts you run AFTER building your main app. They tell Lovable to review its own code for broken states, missing responsive layouts, auth guard gaps, and data integrity issues. Think of them as a QA engineer built into your prompt set.",
  },
  {
    q: "Do I need to use all 50+ prompts?",
    a: "The prompts are ordered but modular. You can skip prompts for features you don't need. The dependency system tells you which prompts are required vs optional.",
  },
  {
    q: "What tech stack do the generated prompts use?",
    a: "By default: React, Vite, Tailwind CSS, shadcn/ui, Supabase (for auth, database, storage), and Stripe (for payments if needed). The AI architect asks about your preferences and adjusts.",
  },
];

const FaqSection = () => {
  return (
    <section className="container py-24">
      <ScrollReveal className="mx-auto max-w-2xl text-center">
        <p className="mb-4 font-body text-xs font-medium uppercase tracking-[0.15em] text-primary">
          FAQ
        </p>
        <h2 className="font-heading text-3xl leading-[1.15] text-foreground md:text-[40px]">
          Questions? Answers.
        </h2>
      </ScrollReveal>

      <ScrollReveal delay={100} className="mx-auto mt-14 max-w-[720px]">
        <Accordion type="single" collapsible defaultValue="item-0">
          {faqs.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="mb-3 overflow-hidden rounded-card border border-border bg-card data-[state=open]:border-l-[3px] data-[state=open]:border-l-primary"
            >
              <AccordionTrigger className="px-6 py-5 font-heading text-base text-foreground hover:no-underline [&>svg]:text-muted-foreground">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-5 font-body text-sm font-light leading-relaxed text-muted-foreground">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </ScrollReveal>
    </section>
  );
};

export default FaqSection;
