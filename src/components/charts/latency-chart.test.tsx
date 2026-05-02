import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import enMessages from "../../../messages/en.json";
import ptMessages from "../../../messages/pt.json";
import { LatencyChart, type LatencySample, type LatencyWindow } from "./latency-chart";

const HOUR_MS = 60 * 60 * 1000;

function makeSamples(count: number, gapMs = HOUR_MS): LatencySample[] {
  const base = Date.UTC(2026, 3, 1, 12, 0, 0);
  return Array.from({ length: count }, (_, i) => ({
    timestamp: new Date(base + i * gapMs),
    p50: 100 + i * 5,
    p95: 200 + i * 10,
  }));
}

function makeAllWindows(samples: LatencySample[]): Record<LatencyWindow, LatencySample[]> {
  return { "1d": samples, "7d": samples, "30d": samples, "90d": samples };
}

function emptyAllWindows(): Record<LatencyWindow, LatencySample[]> {
  return { "1d": [], "7d": [], "30d": [], "90d": [] };
}

function renderChart(
  windows: Record<LatencyWindow, LatencySample[]>,
  locale: "pt" | "en" = "pt",
  defaultWindow: LatencyWindow = "7d",
  serviceName = "Receita Federal",
) {
  const messages = locale === "pt" ? ptMessages : enMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <LatencyChart windows={windows} defaultWindow={defaultWindow} serviceName={serviceName} />
    </NextIntlClientProvider>,
  );
}

describe("LatencyChart", () => {
  it("renders the segmented control with 4 windows and the default selected", () => {
    renderChart(makeAllWindows(makeSamples(8)));

    const group = screen.getByRole("group", { name: "Janela de tempo" });
    const buttons = within(group).getAllByRole("button");
    expect(buttons.map((b) => b.getAttribute("data-window"))).toEqual(["1d", "7d", "30d", "90d"]);
    expect(buttons[1]).toHaveAttribute("aria-pressed", "true");
    expect(buttons[0]).toHaveAttribute("aria-pressed", "false");
  });

  it("clicking another window sets it as active and clears the marker", () => {
    renderChart(makeAllWindows(makeSamples(8)));
    const group = screen.getByRole("group", { name: "Janela de tempo" });
    const button1d = within(group).getByRole("button", { name: "Últimas 24 horas" });

    fireEvent.click(button1d);
    expect(button1d).toHaveAttribute("aria-pressed", "true");
    // The 7d button is now inactive
    expect(within(group).getByRole("button", { name: "Últimos 7 dias" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("renders both p50 and p95 line series", () => {
    const { container } = renderChart(makeAllWindows(makeSamples(5)));
    expect(container.querySelector('[data-line-series="p50"]')).not.toBeNull();
    expect(container.querySelector('[data-line-series="p95"]')).not.toBeNull();
  });

  it("links the SVG to a sr-only data table via aria-describedby", () => {
    const samples = makeSamples(3);
    const { container } = renderChart(makeAllWindows(samples));
    const svg = screen.getByRole("img");
    const describedBy = svg.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();

    // describedby is space-separated; first id is the table, second is the instructions
    const ids = (describedBy ?? "").split(" ");
    const tableEl = ids
      .map((id) => container.querySelector(`#${CSS.escape(id)}`))
      .find((el) => el?.tagName.toLowerCase() === "table");
    expect(tableEl).not.toBeNull();

    if (!tableEl) return;
    const rows = within(tableEl as HTMLElement).getAllByRole("row");
    expect(rows).toHaveLength(samples.length + 1); // 1 header + N body rows
    expect(within(tableEl as HTMLElement).getAllByRole("cell").length).toBe(samples.length * 3);
  });

  it("table content updates when the window changes", () => {
    const longSamples = makeSamples(20);
    const shortSamples = makeSamples(2);
    renderChart({ "1d": shortSamples, "7d": longSamples, "30d": longSamples, "90d": longSamples });

    expect(screen.getByRole("table").querySelectorAll("tbody tr")).toHaveLength(20);

    fireEvent.click(screen.getByRole("button", { name: "Últimas 24 horas" }));
    expect(screen.getByRole("table").querySelectorAll("tbody tr")).toHaveLength(2);
  });

  it("shows a tooltip on overlay focus with timestamp and p50/p95 values", () => {
    const samples: LatencySample[] = [
      {
        timestamp: new Date(Date.UTC(2026, 3, 1, 12, 0, 0)),
        p50: 120,
        p95: 380,
      },
    ];
    renderChart(makeAllWindows(samples));

    expect(screen.queryByRole("tooltip")).toBeNull();

    const overlay = document.querySelector(
      'rect[aria-label="Use as setas para percorrer as amostras."]',
    ) as SVGRectElement | null;
    expect(overlay).not.toBeNull();
    if (!overlay) return;

    fireEvent.focus(overlay);

    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("p50: 120 ms");
    expect(tip).toHaveTextContent("p95: 380 ms");
  });

  it("ArrowLeft / ArrowRight on the overlay walk through samples", () => {
    const samples = makeSamples(4);
    renderChart(makeAllWindows(samples));
    const overlay = document.querySelector(
      'rect[aria-label="Use as setas para percorrer as amostras."]',
    ) as SVGRectElement | null;
    expect(overlay).not.toBeNull();
    if (!overlay) return;

    fireEvent.focus(overlay);
    // Default focus selects the last sample → p50=115
    expect(screen.getByRole("tooltip")).toHaveTextContent("p50: 115 ms");

    fireEvent.keyDown(overlay, { key: "ArrowLeft" });
    expect(screen.getByRole("tooltip")).toHaveTextContent("p50: 110 ms");

    fireEvent.keyDown(overlay, { key: "Home" });
    expect(screen.getByRole("tooltip")).toHaveTextContent("p50: 100 ms");

    fireEvent.keyDown(overlay, { key: "ArrowRight" });
    expect(screen.getByRole("tooltip")).toHaveTextContent("p50: 105 ms");

    fireEvent.keyDown(overlay, { key: "End" });
    expect(screen.getByRole("tooltip")).toHaveTextContent("p50: 115 ms");

    // Clamp at end
    fireEvent.keyDown(overlay, { key: "ArrowRight" });
    expect(screen.getByRole("tooltip")).toHaveTextContent("p50: 115 ms");
  });

  it("renders 'no data' tooltip values when a sample has null p50/p95", () => {
    const samples: LatencySample[] = [
      {
        timestamp: new Date(Date.UTC(2026, 3, 1)),
        p50: null,
        p95: null,
      },
    ];
    renderChart(makeAllWindows(samples));
    const overlay = document.querySelector(
      'rect[aria-label="Use as setas para percorrer as amostras."]',
    ) as SVGRectElement | null;
    if (!overlay) throw new Error("overlay missing");
    fireEvent.focus(overlay);

    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("p50: sem dados");
    expect(tip).toHaveTextContent("p95: sem dados");
  });

  it("renders an empty-state message inside the SVG when the active window has no samples", () => {
    renderChart(emptyAllWindows());
    expect(screen.getByText("Sem amostras de latência nesta janela.")).toBeInTheDocument();
    // No overlay rect to focus when empty
    expect(
      document.querySelector('rect[aria-label="Use as setas para percorrer as amostras."]'),
    ).toBeNull();
  });

  it("uses EN strings and exposes the full ariaLabel when locale=en", () => {
    renderChart(makeAllWindows(makeSamples(2)), "en", "7d", "Receita Federal");

    expect(screen.getByRole("group", { name: "Time window" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Last 7 days" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const titleEl = screen.getByRole("img").querySelector("title");
    expect(titleEl?.textContent).toBe("Latency for Receita Federal (Last 7 days)");
  });

  it("respects the defaultWindow prop", () => {
    renderChart(makeAllWindows(makeSamples(3)), "pt", "30d");
    expect(screen.getByRole("button", { name: "Últimos 30 dias" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
