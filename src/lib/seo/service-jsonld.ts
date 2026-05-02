/**
 * Per-service JSON-LD: emits a `@graph` with a `Service` node and a
 * `BreadcrumbList` (Home → Category → Service). Pure — the consuming RSC
 * inlines the result via `<script type="application/ld+json">` and our
 * `serializeJsonLd()` helper.
 *
 * Schema decisions:
 *  - Provider is modelled as `GovernmentOrganization` (the agency that runs
 *    the service); StatusBrasil itself is a separate publisher node.
 *  - `availableChannel.serviceUrl` points at the official agency URL — the
 *    actual entry point, not our dashboard.
 *  - `areaServed` is hardcoded to "BR" (we only track Brazilian services).
 *  - Per Google Rich Results guidance the leaf `BreadcrumbList` item omits
 *    `item` since it represents the current page.
 */

export interface ServiceJsonLdInput {
  siteUrl: string;
  locale: string;
  /** Localized brand name, used in the breadcrumb root and as publisher.name. */
  brandName: string;
  service: {
    slug: string;
    name: string;
    agency: string;
    /** schema.org `serviceType`: short noun phrase (e.g. "Saúde", "Atendimento"). */
    serviceType: string;
    /** Free-text description of the service, optional. */
    description?: string | null;
    /** Official URL of the agency-run service. */
    officialUrl: string;
  };
  category: {
    /** Stable slug; used to build the home anchor. */
    key: string;
    /** Localized label shown in the breadcrumb middle item. */
    label: string;
  };
}

export interface ServiceJsonLdGraph {
  "@context": "https://schema.org";
  "@graph": [ServiceNode, BreadcrumbListNode];
}

interface ServiceNode {
  "@type": "Service";
  "@id": string;
  name: string;
  serviceType: string;
  areaServed: AreaServed;
  provider: ProviderNode;
  availableChannel: ServiceChannelNode;
  url: string;
  description?: string;
  inLanguage: string;
}

interface AreaServed {
  "@type": "Country";
  name: "Brazil";
  identifier: "BR";
}

interface ProviderNode {
  "@type": "GovernmentOrganization";
  name: string;
  areaServed: AreaServed;
}

interface ServiceChannelNode {
  "@type": "ServiceChannel";
  serviceUrl: string;
  availableLanguage: string[];
}

interface BreadcrumbListNode {
  "@type": "BreadcrumbList";
  itemListElement: BreadcrumbItem[];
}

interface BreadcrumbItem {
  "@type": "ListItem";
  position: number;
  name: string;
  item?: string;
}

const BR_AREA: AreaServed = {
  "@type": "Country",
  name: "Brazil",
  identifier: "BR",
};

export function buildServiceJsonLd(input: ServiceJsonLdInput): ServiceJsonLdGraph {
  const siteUrl = input.siteUrl.replace(/\/+$/, "");
  const homeUrl = `${siteUrl}/${input.locale}`;
  const categoryUrl = `${homeUrl}#category-${input.category.key}`;
  const serviceUrl = `${homeUrl}/servico/${input.service.slug}`;

  const serviceNode: ServiceNode = {
    "@type": "Service",
    "@id": `${serviceUrl}#service`,
    name: input.service.name,
    serviceType: input.service.serviceType,
    areaServed: BR_AREA,
    provider: {
      "@type": "GovernmentOrganization",
      name: input.service.agency,
      areaServed: BR_AREA,
    },
    availableChannel: {
      "@type": "ServiceChannel",
      serviceUrl: input.service.officialUrl,
      availableLanguage: ["pt-BR"],
    },
    url: serviceUrl,
    inLanguage: input.locale,
  };
  if (input.service.description) {
    serviceNode.description = input.service.description;
  }

  const breadcrumb: BreadcrumbListNode = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: input.brandName, item: homeUrl },
      { "@type": "ListItem", position: 2, name: input.category.label, item: categoryUrl },
      // Leaf omits `item` per Google guidance — it represents the current page.
      { "@type": "ListItem", position: 3, name: input.service.name },
    ],
  };

  return {
    "@context": "https://schema.org",
    "@graph": [serviceNode, breadcrumb],
  };
}
