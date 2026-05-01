import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import type { HomeCategoryGroup, ServiceCardRow, ServiceWithStatus } from "@/lib/queries/services";
import enMessages from "../../messages/en.json";
import ptMessages from "../../messages/pt.json";
import { EmQuedaAgora } from "./em-queda-agora";

const NOW = new Date("2026-05-01T12:00:00Z");

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

function group(category: string, services: ServiceCardRow[]): HomeCategoryGroup {
  return { category, services };
}

function renderBanner(groups: HomeCategoryGroup[], locale: "pt" | "en" = "pt", nowOverride?: Date) {
  const messages = locale === "pt" ? ptMessages : enMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages} now={NOW}>
      <EmQuedaAgora groups={groups} now={nowOverride ?? NOW} />
    </NextIntlClientProvider>,
  );
}

describe("EmQuedaAgora", () => {
  it("renders nothing when no service is down or degraded", () => {
    const { container } = renderBanner([
      group("a", [svc({ slug: "ok", status: "operational" })]),
      group("b", [svc({ slug: "huh", status: "unknown" })]),
    ]);
    expect(container.firstChild).toBeNull();
  });

  it("renders an aria-live polite live region with the localized heading and summary (PT)", () => {
    renderBanner([
      group("a", [
        svc({
          slug: "x",
          name: "X",
          status: "down",
          lastIncidentAt: new Date(NOW.getTime() - 60 * 60 * 1000),
        }),
      ]),
    ]);

    const banner = screen.getByRole("region", { name: "Em queda agora" });
    expect(banner).toHaveAttribute("aria-live", "polite");
    expect(within(banner).getByText("1 serviço com problemas neste momento")).toBeInTheDocument();
  });

  it("pluralises the summary when more than one service is flagged (EN)", () => {
    renderBanner(
      [
        group("a", [
          svc({
            slug: "a",
            name: "A",
            status: "down",
            lastIncidentAt: new Date(NOW.getTime() - 30 * 60 * 1000),
          }),
          svc({
            slug: "b",
            name: "B",
            status: "degraded",
            lastIncidentAt: new Date(NOW.getTime() - 30 * 60 * 1000),
          }),
        ]),
      ],
      "en",
    );

    expect(screen.getByText("2 services are having issues right now")).toBeInTheDocument();
  });

  it("orders down before degraded and the more recent first within severity", () => {
    renderBanner([
      group("a", [
        svc({
          slug: "stale-down",
          name: "Stale Down",
          status: "down",
          lastIncidentAt: new Date(NOW.getTime() - 4 * 60 * 60 * 1000),
        }),
        svc({
          slug: "fresh-degraded",
          name: "Fresh Degraded",
          status: "degraded",
          lastIncidentAt: new Date(NOW.getTime() - 30 * 60 * 1000),
        }),
        svc({
          slug: "fresh-down",
          name: "Fresh Down",
          status: "down",
          lastIncidentAt: new Date(NOW.getTime() - 1 * 60 * 60 * 1000),
        }),
      ]),
    ]);

    const items = screen.getAllByRole("link");
    expect(items.map((el) => el.getAttribute("data-slot"))).toEqual(Array(3).fill("em-queda-item"));
    expect(items.map((el) => el.getAttribute("data-status"))).toEqual(["down", "down", "degraded"]);
    const banner = screen.getByRole("region");
    const names = within(banner)
      .getAllByText(/Down|Degraded/)
      .map((el) => el.textContent);
    expect(names).toEqual(["Fresh Down", "Stale Down", "Fresh Degraded"]);
  });

  it("links each item to /servico/[slug]", () => {
    renderBanner([
      group("a", [
        svc({
          slug: "receita-federal",
          name: "Receita",
          status: "down",
          lastIncidentAt: new Date(NOW.getTime() - 60 * 60 * 1000),
        }),
      ]),
    ]);

    expect(screen.getByRole("link")).toHaveAttribute("href", "/servico/receita-federal");
  });

  it("composes the item aria-label with relative time when lastIncidentAt is set (PT)", () => {
    renderBanner([
      group("a", [
        svc({
          slug: "rf",
          name: "Receita Federal",
          agency: "RFB",
          status: "down",
          lastIncidentAt: new Date(NOW.getTime() - 2 * 60 * 60 * 1000),
        }),
      ]),
    ]);

    expect(
      screen.getByRole("link", {
        name: "Receita Federal (RFB): fora do ar, atualizado há 2 horas.",
      }),
    ).toBeInTheDocument();
  });

  it("composes the item aria-label without time when lastIncidentAt is null (PT)", () => {
    renderBanner([
      group("a", [
        svc({
          slug: "rf",
          name: "Receita Federal",
          agency: "RFB",
          status: "degraded",
          lastIncidentAt: null,
        }),
      ]),
    ]);

    expect(
      screen.getByRole("link", { name: "Receita Federal (RFB): instável." }),
    ).toBeInTheDocument();
  });

  it("falls back to the no-update phrase in the visible row when lastIncidentAt is null", () => {
    renderBanner([
      group("a", [
        svc({
          slug: "rf",
          name: "Receita Federal",
          agency: "RFB",
          status: "degraded",
          lastIncidentAt: null,
        }),
      ]),
    ]);

    expect(screen.getByText("sem timestamp de atualização")).toBeInTheDocument();
  });
});
