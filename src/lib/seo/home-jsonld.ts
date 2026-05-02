import { routing } from "@/i18n/routing";

export interface HomeJsonLdInput {
  siteUrl: string;
  locale: string;
  name: string;
  description: string;
}

export interface HomeJsonLdGraph {
  "@context": "https://schema.org";
  "@graph": [WebSiteNode, OrganizationNode];
}

interface WebSiteNode {
  "@type": "WebSite";
  "@id": string;
  url: string;
  name: string;
  description: string;
  inLanguage: string;
  publisher: { "@id": string };
}

interface OrganizationNode {
  "@type": "Organization";
  "@id": string;
  name: string;
  url: string;
  logo: {
    "@type": "ImageObject";
    url: string;
    width: number;
    height: number;
  };
  sameAs: string[];
}

const SAME_AS = ["https://github.com/thiagorech/status-brasil"];
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

export function buildHomeJsonLd(input: HomeJsonLdInput): HomeJsonLdGraph {
  const siteUrl = input.siteUrl.replace(/\/+$/, "");
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}#website`,
        url: `${siteUrl}/${input.locale}`,
        name: input.name,
        description: input.description,
        inLanguage: input.locale,
        publisher: { "@id": `${siteUrl}#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${siteUrl}#organization`,
        name: input.name,
        url: siteUrl,
        logo: {
          "@type": "ImageObject",
          url: `${siteUrl}/${routing.defaultLocale}/opengraph-image`,
          width: OG_WIDTH,
          height: OG_HEIGHT,
        },
        sameAs: SAME_AS,
      },
    ],
  };
}

/**
 * Serializes JSON-LD for safe inlining inside `<script type="application/ld+json">`.
 * Escapes `<` so a `</script>` substring inside a value cannot close the tag.
 */
export function serializeJsonLd(graph: object): string {
  return JSON.stringify(graph).replace(/</g, "\\u003c");
}
