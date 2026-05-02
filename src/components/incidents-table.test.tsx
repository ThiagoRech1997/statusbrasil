import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import type { IncidentRow } from "@/lib/queries/incidents";
import enMessages from "../../messages/en.json";
import ptMessages from "../../messages/pt.json";
import { IncidentsTable } from "./incidents-table";

const NOW = new Date(Date.UTC(2026, 4, 1, 12, 0, 0));

function makeRow(overrides: Partial<IncidentRow> & { id: string }): IncidentRow {
  const base: IncidentRow = {
    id: overrides.id,
    serviceSlug: "rf",
    startedAt: new Date(Date.UTC(2026, 0, 12, 9, 0, 0)),
    endedAt: new Date(Date.UTC(2026, 0, 12, 10, 0, 0)),
    durationSeconds: 60 * 60,
    statusCode: 503,
    errorMessage: "timeout",
    severity: "partial",
  };
  return { ...base, ...overrides };
}

const FIXTURES: IncidentRow[] = [
  makeRow({
    id: "i-old",
    startedAt: new Date(Date.UTC(2026, 0, 1, 8, 0, 0)),
    endedAt: new Date(Date.UTC(2026, 0, 1, 8, 30, 0)),
    durationSeconds: 30 * 60,
    statusCode: 502,
    severity: "partial",
    errorMessage: "Bad gateway",
  }),
  makeRow({
    id: "i-mid",
    startedAt: new Date(Date.UTC(2026, 1, 15, 12, 0, 0)),
    endedAt: new Date(Date.UTC(2026, 1, 15, 14, 0, 0)),
    durationSeconds: 2 * 60 * 60,
    statusCode: 504,
    severity: "total",
    errorMessage: "Gateway timeout",
  }),
  makeRow({
    id: "i-recent",
    startedAt: new Date(Date.UTC(2026, 3, 28, 10, 0, 0)),
    endedAt: null,
    durationSeconds: null,
    statusCode: null,
    severity: "partial",
    errorMessage: null,
  }),
];

const LONG_MESSAGE = "Lorem ipsum ".repeat(20).trim();

function renderTable(
  incidents: IncidentRow[] = FIXTURES,
  locale: "pt" | "en" = "pt",
  pageSize?: number,
) {
  const messages = locale === "pt" ? ptMessages : enMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <IncidentsTable incidents={incidents} pageSize={pageSize} now={NOW} />
    </NextIntlClientProvider>,
  );
}

function getDesktopTable(): HTMLTableElement {
  return screen.getByRole("table");
}

function getDesktopRows(): HTMLTableRowElement[] {
  const tbody = getDesktopTable().querySelector("tbody");
  return Array.from(tbody?.querySelectorAll("tr") ?? []);
}

describe("IncidentsTable", () => {
  it("sorts by startedAt DESC by default", () => {
    renderTable();
    const ids = getDesktopRows().map((r) => r.getAttribute("data-incident-id"));
    expect(ids).toEqual(["i-recent", "i-mid", "i-old"]);

    const startedHead = screen.getByRole("columnheader", { name: /Início/ });
    expect(startedHead).toHaveAttribute("aria-sort", "descending");
  });

  it("clicking the sort button on the active column flips the direction", () => {
    renderTable();
    fireEvent.click(
      screen.getByRole("button", { name: /ordenado por Início, do maior pro menor/ }),
    );

    const ids = getDesktopRows().map((r) => r.getAttribute("data-incident-id"));
    expect(ids).toEqual(["i-old", "i-mid", "i-recent"]);
    expect(screen.getByRole("columnheader", { name: /Início/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  });

  it("clicking another column starts in DESC and updates aria-sort", () => {
    renderTable();
    fireEvent.click(screen.getByRole("button", { name: /ordenar por Severidade/ }));

    const sevHead = screen.getByRole("columnheader", { name: /Severidade/ });
    expect(sevHead).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByRole("columnheader", { name: /Início/ })).toHaveAttribute(
      "aria-sort",
      "none",
    );

    // total > partial in our ranking → with DESC the totals come first
    const ids = getDesktopRows().map((r) => r.getAttribute("data-incident-id"));
    expect(ids[0]).toBe("i-mid"); // the only "total"
  });

  it("sorts by duration treating open incidents by their elapsed time vs `now`", () => {
    renderTable();
    fireEvent.click(screen.getByRole("button", { name: /ordenar por Duração/ }));

    const ids = getDesktopRows().map((r) => r.getAttribute("data-incident-id"));
    // i-recent is open and has elapsed ≈ 3 days, longest → first under DESC
    expect(ids[0]).toBe("i-recent");
    expect(ids[1]).toBe("i-mid"); // 2h
    expect(ids[2]).toBe("i-old"); // 30min
  });

  it("renders a permalink to /incidentes/[id] on every row", () => {
    renderTable();
    const tableLinks = within(getDesktopTable()).getAllByRole("link");
    const hrefs = tableLinks.map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/incidentes/i-recent");
    expect(hrefs).toContain("/incidentes/i-mid");
    expect(hrefs).toContain("/incidentes/i-old");
    const link = within(getDesktopTable()).getByRole("link", {
      name: "Ver detalhes do incidente i-recent",
    });
    expect(link).toHaveAttribute("href", "/incidentes/i-recent");
  });

  it("renders a severity badge with the localized label", () => {
    renderTable();
    const total = getDesktopRows().find((r) => r.dataset.incidentId === "i-mid");
    expect(total).toBeTruthy();
    if (!total) return;
    expect(within(total).getByText("Total")).toBeInTheDocument();
    expect(within(total).getByText("Total").closest("[data-severity]")).toHaveAttribute(
      "data-severity",
      "total",
    );
  });

  it("shows 'em andamento' duration for open incidents and renders missing fields with '—'", () => {
    renderTable();
    const recent = getDesktopRows().find((r) => r.dataset.incidentId === "i-recent");
    if (!recent) throw new Error("missing row");
    expect(within(recent).getByText(/\(em andamento\)/)).toBeInTheDocument();
    expect(within(recent).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("expand/collapse toggle reveals the full message and toggles aria-expanded", () => {
    renderTable([makeRow({ id: "i-long", errorMessage: LONG_MESSAGE })]);

    const expand = within(getDesktopTable()).getByRole("button", {
      name: "ver mensagem completa",
    });
    expect(expand).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(expand);

    const collapse = within(getDesktopTable()).getByRole("button", {
      name: "recolher mensagem",
    });
    expect(collapse).toHaveAttribute("aria-expanded", "true");
    expect(within(getDesktopTable()).getByText(LONG_MESSAGE)).toBeInTheDocument();
  });

  it("does not render an expand button for short messages", () => {
    renderTable([makeRow({ id: "i-short", errorMessage: "short" })]);
    expect(
      within(getDesktopTable()).queryByRole("button", { name: "ver mensagem completa" }),
    ).toBeNull();
  });

  it("paginates and disables Previous on the first page, Next on the last", () => {
    const lots = Array.from({ length: 12 }, (_, i) =>
      makeRow({
        id: `i-${i}`,
        startedAt: new Date(Date.UTC(2026, 0, 1 + i, 9, 0, 0)),
        durationSeconds: 60 * (i + 1),
        statusCode: 500 + i,
      }),
    );
    renderTable(lots, "pt", 5);

    expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
    const prev = screen.getByRole("button", { name: "Anterior" });
    const next = screen.getByRole("button", { name: "Próxima" });
    expect(prev).toBeDisabled();
    expect(next).toBeEnabled();

    fireEvent.click(next);
    expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(screen.getByText("Página 3 de 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
  });

  it("changing the sort resets the pager to page 1", () => {
    const lots = Array.from({ length: 12 }, (_, i) =>
      makeRow({
        id: `i-${i}`,
        startedAt: new Date(Date.UTC(2026, 0, 1 + i, 9, 0, 0)),
      }),
    );
    renderTable(lots, "pt", 5);
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /ordenar por Severidade/ }));
    expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
  });

  it("renders both desktop table and mobile card list (Tailwind handles visibility)", () => {
    const { container } = renderTable();
    expect(container.querySelector("[data-slot='incidents-table']")).not.toBeNull();
    expect(container.querySelector("[data-slot='incidents-cards']")).not.toBeNull();
    const cards = container.querySelectorAll("[data-slot='incidents-cards'] li");
    expect(cards).toHaveLength(3);
    // Mobile cards expose the same data-incident-id attribution
    const ids = Array.from(cards).map((el) => el.getAttribute("data-incident-id"));
    expect(ids).toEqual(["i-recent", "i-mid", "i-old"]);
  });

  it("renders the empty state when there are no incidents and hides the table", () => {
    renderTable([]);
    expect(screen.getByText("Nenhum incidente nos últimos 90 dias.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("uses EN strings when locale=en", () => {
    renderTable(FIXTURES, "en");
    const table = screen.getByRole("table", { name: "Incidents" });
    expect(table).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: /Started/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    expect(within(table).getAllByText("Partial").length).toBeGreaterThan(0);
    expect(within(table).getAllByText("Total").length).toBeGreaterThan(0);
  });
});
