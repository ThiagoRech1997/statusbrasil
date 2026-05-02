import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "./home-jsonld";
import { buildServiceJsonLd, type ServiceJsonLdInput } from "./service-jsonld";

const BASE_INPUT: ServiceJsonLdInput = {
  siteUrl: "https://statusbrasil.example/",
  locale: "pt",
  brandName: "StatusBrasil",
  service: {
    slug: "receita-federal",
    name: "Receita Federal",
    agency: "Receita Federal do Brasil",
    serviceType: "Arrecadação",
    description: "Portal de impostos e declarações da União.",
    officialUrl: "https://www.gov.br/receitafederal",
  },
  category: {
    key: "arrecadacao",
    label: "Arrecadação",
  },
};

describe("buildServiceJsonLd", () => {
  it("emits a Service + BreadcrumbList graph at schema.org context", () => {
    const graph = buildServiceJsonLd(BASE_INPUT);
    expect(graph["@context"]).toBe("https://schema.org");
    expect(graph["@graph"]).toHaveLength(2);
    expect(graph["@graph"][0]?.["@type"]).toBe("Service");
    expect(graph["@graph"][1]?.["@type"]).toBe("BreadcrumbList");
  });

  it("Service node carries provider, areaServed=BR, availableChannel.serviceUrl, url, inLanguage", () => {
    const [service] = buildServiceJsonLd(BASE_INPUT)["@graph"];

    expect(service).toMatchObject({
      "@type": "Service",
      "@id": "https://statusbrasil.example/pt/servico/receita-federal#service",
      name: "Receita Federal",
      serviceType: "Arrecadação",
      url: "https://statusbrasil.example/pt/servico/receita-federal",
      inLanguage: "pt",
      areaServed: { "@type": "Country", name: "Brazil", identifier: "BR" },
      provider: {
        "@type": "GovernmentOrganization",
        name: "Receita Federal do Brasil",
        areaServed: { "@type": "Country", identifier: "BR" },
      },
      availableChannel: {
        "@type": "ServiceChannel",
        serviceUrl: "https://www.gov.br/receitafederal",
        availableLanguage: ["pt-BR"],
      },
    });
  });

  it("includes service.description when provided and omits it when null/empty", () => {
    const withDesc = buildServiceJsonLd(BASE_INPUT)["@graph"][0];
    expect(withDesc).toHaveProperty("description", BASE_INPUT.service.description);

    const withoutDesc = buildServiceJsonLd({
      ...BASE_INPUT,
      service: { ...BASE_INPUT.service, description: null },
    })["@graph"][0];
    expect(withoutDesc).not.toHaveProperty("description");

    const emptyDesc = buildServiceJsonLd({
      ...BASE_INPUT,
      service: { ...BASE_INPUT.service, description: "" },
    })["@graph"][0];
    expect(emptyDesc).not.toHaveProperty("description");
  });

  it("BreadcrumbList has 3 items: brand → category (with #anchor) → service (no `item`)", () => {
    const [, breadcrumb] = buildServiceJsonLd(BASE_INPUT)["@graph"];
    expect(breadcrumb.itemListElement).toHaveLength(3);

    expect(breadcrumb.itemListElement[0]).toEqual({
      "@type": "ListItem",
      position: 1,
      name: "StatusBrasil",
      item: "https://statusbrasil.example/pt",
    });
    expect(breadcrumb.itemListElement[1]).toEqual({
      "@type": "ListItem",
      position: 2,
      name: "Arrecadação",
      item: "https://statusbrasil.example/pt#category-arrecadacao",
    });
    // Leaf must omit `item` per Google guidance (current page).
    expect(breadcrumb.itemListElement[2]).toEqual({
      "@type": "ListItem",
      position: 3,
      name: "Receita Federal",
    });
    expect(breadcrumb.itemListElement[2]).not.toHaveProperty("item");
  });

  it("strips trailing slashes from siteUrl so URLs never double up", () => {
    const graph = buildServiceJsonLd({
      ...BASE_INPUT,
      siteUrl: "https://statusbrasil.example/////",
    });
    const service = graph["@graph"][0];
    expect(service.url).toBe("https://statusbrasil.example/pt/servico/receita-federal");
    expect(graph["@graph"][1].itemListElement[0]?.item).toBe("https://statusbrasil.example/pt");
  });

  it("respects the locale across URLs and inLanguage", () => {
    const graph = buildServiceJsonLd({ ...BASE_INPUT, locale: "en" });
    expect(graph["@graph"][0].url).toBe("https://statusbrasil.example/en/servico/receita-federal");
    expect(graph["@graph"][0].inLanguage).toBe("en");
    expect(graph["@graph"][1].itemListElement[0]?.item).toBe("https://statusbrasil.example/en");
  });

  it("survives serialization through serializeJsonLd with `<` escaped", () => {
    const json = serializeJsonLd(
      buildServiceJsonLd({
        ...BASE_INPUT,
        service: { ...BASE_INPUT.service, name: "</script><b>x</b>" },
      }),
    );
    expect(json).not.toContain("</script>");
    expect(json).toContain("\\u003c/script>");
  });
});
