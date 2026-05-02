import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import enMessages from "../../messages/en.json";
import ptMessages from "../../messages/pt.json";
import { DowntimeTicker } from "./downtime-ticker";

const SERVICES = [
  { slug: "rf", name: "Receita Federal" },
  { slug: "inss", name: "Meu INSS" },
  { slug: "fgts", name: "FGTS" },
];

function renderTicker(downtimeBySlug: Record<string, number>, locale: "pt" | "en" = "pt") {
  const messages = locale === "pt" ? ptMessages : enMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <DowntimeTicker downtimeBySlug={downtimeBySlug} services={SERVICES} />
    </NextIntlClientProvider>,
  );
}

describe("DowntimeTicker", () => {
  it("renders the positive empty state when there is no downtime (PT)", () => {
    renderTicker({});
    expect(
      screen.getByText("Nenhuma indisponibilidade somada nas últimas 24h."),
    ).toBeInTheDocument();
    expect(screen.getByRole("complementary")).toHaveAttribute("data-state", "clear");
  });

  it("renders the summary line with humanised duration when downtime exists (PT)", () => {
    renderTicker({ rf: 600, inss: 3 * 60 * 60 + 22 * 60, fgts: 0 });
    // total: 600 + 12120 = 12720 seconds = 212min = 3h 32min
    expect(
      screen.getByText(
        "Hoje, 3 horas e 32 minutos de indisponibilidade somada nos serviços monitorados.",
      ),
    ).toBeInTheDocument();
  });

  it("renders the worst-service highlight line when at least one service has downtime (PT)", () => {
    renderTicker({ rf: 600, inss: 3 * 60 * 60 + 22 * 60 });
    expect(screen.getByText("Meu INSS responde por 3 horas e 22 minutos.")).toBeInTheDocument();
  });

  it("hides the worst-service line when no service shows positive downtime (PT)", () => {
    renderTicker({});
    expect(screen.queryByText(/responde por/)).not.toBeInTheDocument();
  });

  it("formats summary and worst lines in EN with 'and' connector and singular/plural units", () => {
    renderTicker({ rf: 60, inss: 60 * 60 + 60 }, "en");
    // total: 60 + 3660 = 3720s = 62min = 1h 2min
    expect(
      screen.getByText(
        "Today, 1 hour and 2 minutes of accumulated downtime across the monitored services.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Meu INSS accounts for 1 hour and 1 minute.")).toBeInTheDocument();
  });

  it("composes the aria-label with both summary and worst clauses (PT)", () => {
    renderTicker({ inss: 2 * 60 * 60 });
    expect(screen.getByRole("complementary")).toHaveAttribute(
      "aria-label",
      "Indisponibilidade acumulada nas últimas 24h: Hoje, 2 horas de indisponibilidade somada nos serviços monitorados. Meu INSS responde por 2 horas.",
    );
  });

  it("marks the ticker as downtime state when totalSeconds > 0", () => {
    renderTicker({ rf: 300 });
    expect(screen.getByRole("complementary")).toHaveAttribute("data-state", "downtime");
  });

  it("ignores slugs not present in the services list when picking the worst (still counts toward total)", () => {
    renderTicker({ "ghost-service": 4 * 60 * 60, rf: 30 * 60 });
    // Total: 14400 + 1800 = 16200s = 270min = 4h 30min
    expect(
      screen.getByText(
        "Hoje, 4 horas e 30 minutos de indisponibilidade somada nos serviços monitorados.",
      ),
    ).toBeInTheDocument();
    // Worst should be Receita Federal (the only known service in the map)
    expect(screen.getByText("Receita Federal responde por 30 minutos.")).toBeInTheDocument();
  });
});
