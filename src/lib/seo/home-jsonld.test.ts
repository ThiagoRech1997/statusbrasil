import { describe, expect, it } from "vitest";
import { buildHomeJsonLd, serializeJsonLd } from "./home-jsonld";

const INPUT = {
  siteUrl: "https://statusbrasil.example",
  locale: "pt",
  name: "StatusBrasil",
  description: "Disponibilidade dos serviços do governo brasileiro",
} as const;

describe("buildHomeJsonLd", () => {
  it("returns a @graph with WebSite + Organization nodes", () => {
    const graph = buildHomeJsonLd(INPUT);

    expect(graph["@context"]).toBe("https://schema.org");
    const [website, org] = graph["@graph"];

    expect(website).toMatchObject({
      "@type": "WebSite",
      "@id": "https://statusbrasil.example#website",
      url: "https://statusbrasil.example/pt",
      name: "StatusBrasil",
      description: INPUT.description,
      inLanguage: "pt",
      publisher: { "@id": "https://statusbrasil.example#organization" },
    });

    expect(org).toMatchObject({
      "@type": "Organization",
      "@id": "https://statusbrasil.example#organization",
      url: "https://statusbrasil.example",
      logo: {
        "@type": "ImageObject",
        url: "https://statusbrasil.example/pt/opengraph-image",
        width: 1200,
        height: 630,
      },
    });
    expect(org.sameAs).toContain("https://github.com/thiagorech/status-brasil");
  });

  it("strips trailing slashes from siteUrl so URLs never double up", () => {
    const graph = buildHomeJsonLd({ ...INPUT, siteUrl: "https://statusbrasil.example///" });
    expect(graph["@graph"][0].url).toBe("https://statusbrasil.example/pt");
    expect(graph["@graph"][1].url).toBe("https://statusbrasil.example");
  });

  it("uses the request locale on WebSite.url + inLanguage but the default locale for the logo", () => {
    const graph = buildHomeJsonLd({ ...INPUT, locale: "en" });
    expect(graph["@graph"][0].url).toBe("https://statusbrasil.example/en");
    expect(graph["@graph"][0].inLanguage).toBe("en");
    expect(graph["@graph"][1].logo.url).toBe("https://statusbrasil.example/pt/opengraph-image");
  });
});

describe("serializeJsonLd", () => {
  it("escapes `<` so a value cannot close the parent <script> tag", () => {
    const graph = buildHomeJsonLd({
      ...INPUT,
      description: "evil </script><script>alert(1)</script>",
    });
    const out = serializeJsonLd(graph);
    expect(out).not.toContain("</script>");
    expect(out).toContain("\\u003c/script>");
    expect(JSON.parse(out)).toEqual(graph);
  });
});
