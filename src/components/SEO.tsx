import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";

interface SEOProps {
  title?: string;
  description?: string;
  ogImage?: string;
  structuredData?: Record<string, unknown>;
  /** When true, adds <meta name="robots" content="noindex, nofollow" />. Use for authenticated/private routes. */
  noindex?: boolean;
  /** Override the canonical URL. Defaults to https://lovplan.com + current path. */
  canonical?: string;
}

const SITE_URL = "https://lovplan.com";

const defaults = {
  title: "LovPlan — AI-Powered Prompt Blueprints for Lovable Builders",
  description:
    "LovPlan's AI architect interviews you about your idea, then generates 50+ structured, dependency-ordered prompts so your Lovable app is built right the first time.",
  ogImage: `${SITE_URL}/og-image.png`,
};

const SEO = ({
  title,
  description = defaults.description,
  ogImage = defaults.ogImage,
  structuredData,
  noindex = false,
  canonical,
}: SEOProps) => {
  const location = useLocation();
  const fullTitle = title ? `${title} — LovPlan` : defaults.title;
  const canonicalUrl = canonical ?? `${SITE_URL}${location.pathname}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content="LovPlan" />

      {/* Twitter */}
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
