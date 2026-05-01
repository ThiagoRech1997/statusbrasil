import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import enMessages from "../../messages/en.json";
import ptMessages from "../../messages/pt.json";
import { type ServiceStatus, ServiceStatusCard } from "./service-status-card";

const NOW = new Date("2026-05-01T12:00:00Z");
const TWO_HOURS_AGO = new Date("2026-05-01T10:00:00Z");

const DEFAULT_PROPS: ComponentProps<typeof ServiceStatusCard> = {
  slug: "receita-federal",
  name: "Receita Federal",
  agency: "Ministério da Fazenda",
  status: "operational",
  uptime7dPct: 99.2,
  lastIncidentAt: TWO_HOURS_AGO,
  now: NOW,
};

function renderCard(
  overrides: Partial<ComponentProps<typeof ServiceStatusCard>> = {},
  locale: "pt" | "en" = "pt",
) {
  const messages = locale === "pt" ? ptMessages : enMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages} now={NOW}>
      <ServiceStatusCard {...DEFAULT_PROPS} {...overrides} />
    </NextIntlClientProvider>,
  );
}

describe("ServiceStatusCard", () => {
  it("renders the service name and agency", () => {
    renderCard();
    expect(screen.getByText("Receita Federal")).toBeInTheDocument();
    expect(screen.getByText("Ministério da Fazenda")).toBeInTheDocument();
  });

  it("links to the localized service detail page", () => {
    renderCard();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/servico/receita-federal");
  });

  it("renders the status pill with the localized PT label", () => {
    renderCard();
    expect(screen.getByText("Operacional")).toBeInTheDocument();
  });

  it("renders the status pill with the localized EN label", () => {
    renderCard({}, "en");
    expect(screen.getByText("Operational")).toBeInTheDocument();
  });

  it("formats the 7d uptime as a localized percentage (PT comma)", () => {
    renderCard();
    expect(screen.getByText("99,2%")).toBeInTheDocument();
  });

  it("formats the 7d uptime as a localized percentage (EN dot)", () => {
    renderCard({}, "en");
    expect(screen.getByText("99.2%")).toBeInTheDocument();
  });

  it("falls back to 'sem dados' when uptime is null", () => {
    renderCard({ uptime7dPct: null });
    expect(screen.getByText("sem dados")).toBeInTheDocument();
  });

  it("renders the last-incident time as a relative phrase", () => {
    renderCard();
    expect(screen.getByText("há 2 horas")).toBeInTheDocument();
  });

  it("falls back to 'sem incidentes recentes' when no last incident", () => {
    renderCard({ lastIncidentAt: null });
    expect(screen.getByText("sem incidentes recentes")).toBeInTheDocument();
  });

  it("accepts ISO strings for lastIncidentAt", () => {
    renderCard({ lastIncidentAt: TWO_HOURS_AGO.toISOString() });
    expect(screen.getByText("há 2 horas")).toBeInTheDocument();
  });

  it("encodes the status into data-status on the card and pill", () => {
    renderCard({ status: "down" });
    const card = screen.getByRole("link");
    expect(card).toHaveAttribute("data-status", "down");
    const pill = card.querySelector('[data-slot="status-pill"]');
    expect(pill).toHaveAttribute("data-status", "down");
  });

  it.each<ServiceStatus>([
    "operational",
    "degraded",
    "down",
    "unknown",
  ])("renders the localized status text for %s", (status) => {
    renderCard({ status });
    expect(screen.getByText(ptMessages.ServiceStatusCard.status[status])).toBeInTheDocument();
  });

  it("composes a complete aria-label including name, status, uptime and last incident", () => {
    renderCard();
    expect(
      screen.getByRole("link", {
        name: "Receita Federal: operacional, uptime 99,2% nos últimos 7 dias. último incidente há 2 horas.",
      }),
    ).toBeInTheDocument();
  });

  it("composes an aria-label without an incident clause when none is given", () => {
    renderCard({ lastIncidentAt: null });
    expect(
      screen.getByRole("link", {
        name: "Receita Federal: operacional, uptime 99,2% nos últimos 7 dias.",
      }),
    ).toBeInTheDocument();
  });

  it("falls back to 'sem dados de uptime' in the aria-label when uptime is null", () => {
    renderCard({ uptime7dPct: null, lastIncidentAt: null });
    expect(
      screen.getByRole("link", {
        name: "Receita Federal: operacional, sem dados de uptime nos últimos 7 dias.",
      }),
    ).toBeInTheDocument();
  });

  it("matches the visual snapshot for the operational state", () => {
    const { container } = renderCard();
    expect(container.firstChild).toMatchSnapshot();
  });
});
