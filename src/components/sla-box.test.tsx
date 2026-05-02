import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import enMessages from "../../messages/en.json";
import ptMessages from "../../messages/pt.json";
import { SLABox, type SLABoxProps } from "./sla-box";

const NOW = new Date(Date.UTC(2026, 4, 2, 12, 0, 0));

function renderBox(overrides: Partial<SLABoxProps> = {}, locale: "pt" | "en" = "pt") {
  const props: SLABoxProps = {
    target: 99.5,
    currentMonth: 99.7,
    previousMonth: 99.2,
    yearToDate: 99.4,
    now: NOW,
    ...overrides,
  };
  const messages = locale === "pt" ? ptMessages : enMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <SLABox {...props} />
    </NextIntlClientProvider>,
  );
}

function getRow(period: "currentMonth" | "previousMonth" | "yearToDate"): HTMLElement {
  const el = document.querySelector(`[data-period="${period}"]`);
  if (!el) throw new Error(`row ${period} not found`);
  return el as HTMLElement;
}

describe("SLABox", () => {
  it("renders the heading and the formatted target", () => {
    renderBox();
    expect(screen.getByRole("heading", { name: "SLA" })).toBeInTheDocument();
    // 99.5 / 100 → 99,5%
    expect(screen.getByText(/Meta · 99,5%/)).toBeInTheDocument();
  });

  it("renders all three periods with their range labels (PT)", () => {
    renderBox();
    const current = getRow("currentMonth");
    expect(within(current).getByText("Mês atual")).toBeInTheDocument();
    expect(within(current).getByText(/maio de 2026/)).toBeInTheDocument();

    const prev = getRow("previousMonth");
    expect(within(prev).getByText("Mês anterior")).toBeInTheDocument();
    expect(within(prev).getByText(/abril de 2026/)).toBeInTheDocument();

    const ytd = getRow("yearToDate");
    expect(within(ytd).getByText("Acumulado 2026")).toBeInTheDocument();
  });

  it("colors above-target rows green and below-target rows red via data-comparison", () => {
    renderBox();
    expect(getRow("currentMonth")).toHaveAttribute("data-comparison", "above"); // 99.7 ≥ 99.5
    expect(getRow("previousMonth")).toHaveAttribute("data-comparison", "below"); // 99.2 < 99.5
    expect(getRow("yearToDate")).toHaveAttribute("data-comparison", "below"); // 99.4 < 99.5
  });

  it("treats actual == target as 'above' (≥)", () => {
    renderBox({ currentMonth: 99.5 });
    expect(getRow("currentMonth")).toHaveAttribute("data-comparison", "above");
  });

  it("renders neutral 'no-data' rows when an actual is null and shows the unknown copy", () => {
    renderBox({ currentMonth: null, previousMonth: null, yearToDate: null });
    expect(getRow("currentMonth")).toHaveAttribute("data-comparison", "no-data");
    const unknowns = screen.getAllByText("sem dados");
    expect(unknowns).toHaveLength(3);
  });

  it("renders 'Sem meta definida' and 'no-target' rows when target is null", () => {
    renderBox({ target: null });
    expect(screen.getByText("Sem meta definida")).toBeInTheDocument();
    expect(getRow("currentMonth")).toHaveAttribute("data-comparison", "no-target");
    expect(getRow("previousMonth")).toHaveAttribute("data-comparison", "no-target");
    expect(getRow("yearToDate")).toHaveAttribute("data-comparison", "no-target");
  });

  it("toggles the formula tooltip via aria-expanded and reveals the explainer text + methodology link", () => {
    renderBox();
    const toggle = screen.getByRole("button", { name: "Como calculamos" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    const region = document.querySelector("[data-slot='sla-formula']") as HTMLElement | null;
    expect(region).not.toBeNull();
    if (!region) return;
    expect(region.id).toBe(toggle.getAttribute("aria-controls"));
    expect(within(region).getByText(/Uptime = \(1 − checks falhos/)).toBeInTheDocument();
    expect(within(region).getByRole("link", { name: "Ver metodologia completa" })).toHaveAttribute(
      "href",
      "/metodologia#sla",
    );

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(document.querySelector("[data-slot='sla-formula']")).toBeNull();
  });

  it("always renders the bottom methodology link, regardless of tooltip state", () => {
    renderBox();
    const link = screen.getByRole("link", { name: /Ver metodologia completa →/ });
    expect(link).toHaveAttribute("href", "/metodologia#sla");
  });

  it("composes per-row aria-label with period, range, value and comparison clauses", () => {
    renderBox();
    expect(getRow("currentMonth")).toHaveAttribute(
      "aria-label",
      "Mês atual (maio de 2026): 99,7%, acima da meta de 99,5%",
    );
    expect(getRow("previousMonth")).toHaveAttribute(
      "aria-label",
      "Mês anterior (abril de 2026): 99,2%, abaixo da meta de 99,5%",
    );
  });

  it("composes the unknown aria-label when the actual is null", () => {
    renderBox({ yearToDate: null });
    expect(getRow("yearToDate")).toHaveAttribute("aria-label", "Acumulado 2026 (2026): sem dados");
  });

  it("renders deltas in p.p. with sign and 'no alvo' when delta is exactly 0", () => {
    renderBox({ currentMonth: 99.5, previousMonth: 99.7, yearToDate: 99.0 });
    expect(within(getRow("currentMonth")).getByText("no alvo")).toBeInTheDocument();
    expect(
      within(getRow("previousMonth")).getByText("+0,2 p.p. acima da meta"),
    ).toBeInTheDocument();
    expect(within(getRow("yearToDate")).getByText("−0,5 p.p. abaixo da meta")).toBeInTheDocument();
  });

  it("rolls the previous-month range label across year boundaries (Jan → previous = Dec/last year)", () => {
    renderBox({ now: new Date(Date.UTC(2026, 0, 15, 12, 0, 0)) });
    expect(within(getRow("currentMonth")).getByText(/janeiro de 2026/)).toBeInTheDocument();
    expect(within(getRow("previousMonth")).getByText(/dezembro de 2025/)).toBeInTheDocument();
    expect(within(getRow("yearToDate")).getByText("Acumulado 2026")).toBeInTheDocument();
  });

  it("uses EN strings and number formatting when locale=en", () => {
    renderBox({}, "en");
    expect(screen.getByText(/Target · 99\.5%/)).toBeInTheDocument();
    expect(within(getRow("currentMonth")).getByText("Current month")).toBeInTheDocument();
    expect(within(getRow("currentMonth")).getByText(/May 2026/)).toBeInTheDocument();
    expect(within(getRow("yearToDate")).getByText("Year-to-date 2026")).toBeInTheDocument();
    expect(getRow("currentMonth")).toHaveAttribute(
      "aria-label",
      "Current month (May 2026): 99.7%, above the 99.5% target",
    );
  });
});
