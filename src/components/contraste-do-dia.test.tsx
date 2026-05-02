import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import type { ServiceCardRow, ServiceWithStatus } from "@/lib/queries/services";
import enMessages from "../../messages/en.json";
import ptMessages from "../../messages/pt.json";
import { ContrasteDoDia } from "./contraste-do-dia";

function svc(over: Partial<ServiceCardRow> & { slug: string }): ServiceCardRow {
  const base: ServiceWithStatus = {
    slug: over.slug,
    name: over.name ?? over.slug,
    agency: over.agency ?? "Test Agency",
    category: over.category ?? "atendimento",
    sphere: over.sphere ?? "federal",
    url: over.url ?? `https://example.test/${over.slug}`,
    description: over.description ?? null,
    active: over.active ?? true,
    createdAt: over.createdAt ?? new Date("2026-01-01T00:00:00Z"),
    status: over.status ?? "operational",
    uptime1h: "uptime1h" in over ? (over.uptime1h as number | null) : 100,
  };
  return {
    ...base,
    uptime24hPct: "uptime24hPct" in over ? (over.uptime24hPct as number | null) : null,
    uptime7dPct: "uptime7dPct" in over ? (over.uptime7dPct as number | null) : null,
    lastIncidentAt: "lastIncidentAt" in over ? (over.lastIncidentAt as Date | null) : null,
  };
}

function renderBanner(services: ServiceCardRow[], locale: "pt" | "en" = "pt") {
  const messages = locale === "pt" ? ptMessages : enMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ContrasteDoDia services={services} />
    </NextIntlClientProvider>,
  );
}

const FIXTURE: ServiceCardRow[] = [
  svc({
    slug: "receita-federal",
    name: "Receita Federal",
    agency: "Receita Federal do Brasil",
    category: "arrecadacao",
    uptime24hPct: 99.2,
  }),
  svc({
    slug: "ecac",
    name: "e-CAC",
    agency: "Receita Federal do Brasil",
    category: "arrecadacao",
    uptime24hPct: 98.0,
  }),
  svc({
    slug: "meu-inss",
    name: "Meu INSS",
    agency: "INSS",
    category: "atendimento",
    uptime24hPct: 78.5,
  }),
  svc({
    slug: "fgts",
    name: "FGTS",
    agency: "Caixa",
    category: "atendimento",
    uptime24hPct: 92.0,
  }),
];

describe("ContrasteDoDia", () => {
  it("returns null when pickContrast finds no eligible pair", () => {
    const { container } = renderBanner([
      svc({ slug: "saude", category: "saude", uptime24hPct: 99 }),
    ]);
    expect(container.firstChild).toBeNull();
  });

  it("renders the localized heading and tagline (PT)", () => {
    renderBanner(FIXTURE);
    expect(screen.getByRole("heading", { name: "O contraste de hoje" })).toBeInTheDocument();
    expect(screen.getByText(/Categoria que cobra vs categoria que atende/)).toBeInTheDocument();
  });

  it("renders the localized heading (EN)", () => {
    renderBanner(FIXTURE, "en");
    expect(screen.getByRole("heading", { name: "Today's contrast" })).toBeInTheDocument();
  });

  it("places arrecadacao on the 'good' side and atendimento on the 'bad' side regardless of values", () => {
    renderBanner(FIXTURE);
    const sides = screen.getAllByRole("link");
    expect(sides[0]).toHaveAttribute("data-tone", "good");
    expect(sides[1]).toHaveAttribute("data-tone", "bad");
    expect(within(sides[0] as HTMLElement).getByText("Receita Federal")).toBeInTheDocument();
    expect(within(sides[1] as HTMLElement).getByText("Meu INSS")).toBeInTheDocument();
  });

  it("keeps the editorial side mapping even when atendimento beats arrecadacao", () => {
    renderBanner([
      svc({ slug: "rf", name: "Receita", category: "arrecadacao", uptime24hPct: 70 }),
      svc({ slug: "inss", name: "INSS", category: "atendimento", uptime24hPct: 95 }),
    ]);
    const sides = screen.getAllByRole("link");
    expect(sides[0]).toHaveAttribute("data-tone", "good");
    expect(within(sides[0] as HTMLElement).getByText("Receita")).toBeInTheDocument();
    expect(sides[1]).toHaveAttribute("data-tone", "bad");
    expect(within(sides[1] as HTMLElement).getByText("INSS")).toBeInTheDocument();
  });

  it("formats the uptime values with locale percent formatting (PT comma, EN dot)", () => {
    const { unmount } = renderBanner(FIXTURE);
    expect(screen.getByText("99,2%")).toBeInTheDocument();
    expect(screen.getByText("78,5%")).toBeInTheDocument();
    unmount();
    renderBanner(FIXTURE, "en");
    expect(screen.getByText("99.2%")).toBeInTheDocument();
    expect(screen.getByText("78.5%")).toBeInTheDocument();
  });

  it("renders the percentage-points gap copy (PT)", () => {
    renderBanner(FIXTURE);
    // 99.2 - 78.5 = 20.7
    expect(screen.getByText("Diferença: 20,7 pontos percentuais")).toBeInTheDocument();
  });

  it("renders the percentage-points gap copy (EN)", () => {
    renderBanner(FIXTURE, "en");
    expect(screen.getByText("Difference: 20.7 percentage points")).toBeInTheDocument();
  });

  it("links each side to /servico/[slug]", () => {
    renderBanner(FIXTURE);
    const sides = screen.getAllByRole("link");
    expect(sides[0]).toHaveAttribute("href", "/servico/receita-federal");
    expect(sides[1]).toHaveAttribute("href", "/servico/meu-inss");
  });

  it("composes a complete aria-label with both names, percentages and the gap (PT)", () => {
    renderBanner(FIXTURE);
    const banner = screen.getByRole("region");
    expect(banner).toHaveAttribute(
      "aria-label",
      "O contraste de hoje: Receita Federal (Arrecadação) 99,2%, Meu INSS (Atendimento) 78,5%, diferença de 20,7 pontos percentuais.",
    );
  });
});
