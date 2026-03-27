import { Helmet } from "react-helmet-async";

interface SEOProps {
  title?: string;
  description?: string;
  ogImage?: string;
  structuredData?: Record<string, unknown>;
}

const defaults = {
  title: "LovPlan — AI-Powered Prompt Blueprints for Lovable Builders",
  description:
    "LovPlan's AI architect interviews you about your idea, then generates 50+ structured, dependency-ordered prompts so your Lovable app is built right the first time.",
  ogImage: "https://lovable.dev/opengraph-image-p98pqg.png",
};

const SEO = ({
  title,
  description = defaults.description,
  ogImage = defaults.ogImage,
  structuredData,
}: SEOProps) => {
  const fullTitle = title ? `${title} — LovPlan` : defaults.title;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
};

export default SEO;
