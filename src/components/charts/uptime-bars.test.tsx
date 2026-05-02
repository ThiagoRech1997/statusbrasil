import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import enMessages from "../../../messages/en.json";
import ptMessages from "../../../messages/pt.json";
import { bucketUptime, type UptimeBarPoint, UptimeBars } from "./uptime-bars";

const DAY_MS = 24 * 60 * 60 * 1000;

function makeSeries(count: number, fill: (i: number) => Partial<UptimeBarPoint>): UptimeBarPoint[] {
  const today = Date.UTC(2026, 3, 1);
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(today - (count - 1 - i) * DAY_MS);
    return {
      date,
      uptimePct: 99.5,
      incidentCount: 0,
      ...fill(i),
    };
  });
}

function renderBars(
  data: UptimeBarPoint[],
  locale: "pt" | "en" = "pt",
  serviceName = "Receita Federal",
) {
  const messages = locale === "pt" ? ptMessages : enMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <UptimeBars data={data} serviceName={serviceName} />
    </NextIntlClientProvider>,
  );
}

describe("bucketUptime", () => {
  it("buckets uptime by the documented thresholds", () => {
    expect(bucketUptime(null)).toBe("unknown");
    expect(bucketUptime(100)).toBe("operational");
    expect(bucketUptime(99)).toBe("operational");
    expect(bucketUptime(98.9)).toBe("degraded");
    expect(bucketUptime(95)).toBe("degraded");
    expect(bucketUptime(94.9)).toBe("down");
    expect(bucketUptime(0)).toBe("down");
  });
});

describe("UptimeBars", () => {
  it("renders 90 daily bars with the expected color buckets", () => {
    const data = makeSeries(90, (i) => {
      if (i === 0) return { uptimePct: null }; // unknown
      if (i === 1) return { uptimePct: 92 }; // down
      if (i === 2) return { uptimePct: 97 }; // degraded
      return { uptimePct: 99.9 }; // operational
    });
    renderBars(data);

    const bars = screen.getAllByRole("button");
    expect(bars).toHaveLength(90);
    expect(bars[0]).toHaveAttribute("data-bucket", "unknown");
    expect(bars[1]).toHaveAttribute("data-bucket", "down");
    expect(bars[2]).toHaveAttribute("data-bucket", "degraded");
    expect(bars[3]).toHaveAttribute("data-bucket", "operational");
  });

  it("composes per-bar aria-label with date, uptime and incident count (PT)", () => {
    const data: UptimeBarPoint[] = [
      { date: new Date(Date.UTC(2026, 0, 12)), uptimePct: 99.5, incidentCount: 0 },
      { date: new Date(Date.UTC(2026, 0, 13)), uptimePct: 92, incidentCount: 3 },
    ];
    renderBars(data);

    expect(
      screen.getByRole("button", { name: "12 de janeiro: 99,5% de uptime, sem incidentes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "13 de janeiro: 92,0% de uptime, 3 incidentes" }),
    ).toBeInTheDocument();
  });

  it("falls back to 'no data' label when uptimePct is null", () => {
    const data: UptimeBarPoint[] = [
      { date: new Date(Date.UTC(2026, 0, 12)), uptimePct: null, incidentCount: 0 },
    ];
    renderBars(data);

    expect(
      screen.getByRole("button", { name: "12 de janeiro: sem dados de uptime" }),
    ).toBeInTheDocument();
  });

  it("renders an alternate sr-only table for screen readers and links it via aria-describedby", () => {
    const data: UptimeBarPoint[] = [
      { date: new Date(Date.UTC(2026, 0, 12)), uptimePct: 99.5, incidentCount: 0 },
      { date: new Date(Date.UTC(2026, 0, 13)), uptimePct: null, incidentCount: 0 },
    ];
    renderBars(data);

    const svg = screen.getByRole("img");
    const tableId = svg.getAttribute("aria-describedby");
    expect(tableId).toBeTruthy();

    const table = document.getElementById(tableId ?? "");
    expect(table).not.toBeNull();
    if (!table) return;

    const rows = within(table).getAllByRole("row");
    // 1 header row + 2 body rows
    expect(rows).toHaveLength(3);
    expect(within(table).getByText("12 de janeiro")).toBeInTheDocument();
    expect(within(table).getByText("99,5%")).toBeInTheDocument();
    expect(within(table).getByText("sem dados")).toBeInTheDocument();
  });

  it("uses roving tabindex: only the first bar is tabbable initially", () => {
    const data = makeSeries(5, () => ({ uptimePct: 99.9 }));
    renderBars(data);

    const bars = screen.getAllByRole("button");
    expect(bars[0]).toHaveAttribute("tabindex", "0");
    for (const bar of bars.slice(1)) {
      expect(bar).toHaveAttribute("tabindex", "-1");
    }
  });

  it("ArrowRight moves the active bar forward and updates the roving tabindex", () => {
    const data = makeSeries(5, () => ({ uptimePct: 99.9 }));
    renderBars(data);

    const bars = screen.getAllByRole("button");
    fireEvent.focus(bars[0] as Element);
    fireEvent.keyDown(bars[0] as Element, { key: "ArrowRight" });

    expect(bars[1]).toHaveAttribute("tabindex", "0");
    expect(bars[0]).toHaveAttribute("tabindex", "-1");
  });

  it("ArrowLeft is clamped at the first bar; ArrowRight is clamped at the last", () => {
    const data = makeSeries(3, () => ({ uptimePct: 99.9 }));
    renderBars(data);

    const bars = screen.getAllByRole("button");
    fireEvent.focus(bars[0] as Element);
    fireEvent.keyDown(bars[0] as Element, { key: "ArrowLeft" });
    expect(bars[0]).toHaveAttribute("tabindex", "0");

    fireEvent.keyDown(bars[0] as Element, { key: "End" });
    expect(bars[2]).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(bars[2] as Element, { key: "ArrowRight" });
    expect(bars[2]).toHaveAttribute("tabindex", "0");
  });

  it("shows a tooltip on focus with date, uptime and incident count", () => {
    const data: UptimeBarPoint[] = [
      { date: new Date(Date.UTC(2026, 0, 12)), uptimePct: 99.5, incidentCount: 2 },
    ];
    renderBars(data);

    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.focus(screen.getAllByRole("button")[0] as Element);

    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("12 de janeiro");
    expect(tip).toHaveTextContent("Uptime: 99,5%");
    expect(tip).toHaveTextContent("2 incidentes");
  });

  it("hides the tooltip on blur", () => {
    const data = makeSeries(2, () => ({ uptimePct: 99.9 }));
    renderBars(data);

    const bars = screen.getAllByRole("button");
    fireEvent.focus(bars[0] as Element);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.blur(bars[0] as Element);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("renders an empty placeholder when data is empty", () => {
    renderBars([]);
    expect(screen.getByText("Sem dados para exibir.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("uses EN messages and number formatting when locale=en", () => {
    const data: UptimeBarPoint[] = [
      { date: new Date(Date.UTC(2026, 0, 12)), uptimePct: 99.5, incidentCount: 1 },
    ];
    renderBars(data, "en", "Receita Federal");

    expect(
      screen.getByRole("button", { name: "January 12: 99.5% uptime, 1 incident" }),
    ).toBeInTheDocument();

    const svgTitle = screen.getByRole("img").querySelector("title");
    expect(svgTitle?.textContent).toBe("Daily uptime for Receita Federal over the last 1 days");
  });

  it("wraps the chart in a horizontally scrollable container for mobile", () => {
    const data = makeSeries(90, () => ({ uptimePct: 99.9 }));
    const { container } = renderBars(data);
    const root = container.querySelector("[data-slot='uptime-bars']") as HTMLElement | null;
    expect(root).not.toBeNull();
    const scroller = root?.firstElementChild as HTMLElement | null;
    expect(scroller?.className).toMatch(/overflow-x-auto/);
  });
});
