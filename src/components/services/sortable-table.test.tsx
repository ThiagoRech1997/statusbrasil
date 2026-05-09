import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it } from "vitest";
import type { ServiceWithStatus } from "@/lib/queries/services";
import ptMessages from "../../../messages/pt.json";
import { SortableServicesTable } from "./sortable-table";

function makeService(over: Partial<ServiceWithStatus> & { slug: string }): ServiceWithStatus {
  return {
    slug: over.slug,
    name: over.name ?? over.slug,
    agency: over.agency ?? "Test Agency",
    category: over.category ?? "atendimento",
    sphere: over.sphere ?? "federal",
    url: `https://example.com/${over.slug}`,
    description: null,
    active: true,
    createdAt: new Date("2026-01-01"),
    status: over.status ?? "operational",
    uptime1h: "uptime1h" in over ? (over.uptime1h as number | null) : 100,
  };
}

type UrlUpdateEvent = { searchParams: URLSearchParams; queryString: string };

function renderTable(
  services: ServiceWithStatus[],
  searchParams: Record<string, string> = {},
  onUrlUpdate?: (event: UrlUpdateEvent) => void,
) {
  const result = render(
    <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <SortableServicesTable services={services} />
      </NextIntlClientProvider>
    </NuqsTestingAdapter>,
  );
  return result;
}

/**
 * The component renders both a desktop table and a mobile card list, both in
 * the DOM. De-duplicate via Set (preserves insertion / document order) to get
 * a stable ordered list of slugs without doubling.
 */
function getOrderedSlugs(container: HTMLElement): string[] {
  const all = [...container.querySelectorAll("[data-slug]")].map(
    (el) => el.getAttribute("data-slug") ?? "",
  );
  return [...new Set(all)];
}

// ── Sort logic ───────────────────────────────────────────────────────────────

describe("SortableServicesTable — sort logic", () => {
  it("sorts by status severity asc (down → degraded → unknown → operational) from URL state", () => {
    const services = [
      makeService({ slug: "op", status: "operational" }),
      makeService({ slug: "dn", status: "down" }),
      makeService({ slug: "dg", status: "degraded" }),
      makeService({ slug: "uk", status: "unknown" }),
    ];
    const { container } = renderTable(services, { sort: "status", dir: "asc" });
    expect(getOrderedSlugs(container)).toEqual(["dn", "dg", "uk", "op"]);
  });

  it("sorts non-null uptime values ascending (low before high) with null rows coerced to 0", () => {
    const services = [
      makeService({ slug: "high", uptime1h: 100 }),
      makeService({ slug: "no-data", uptime1h: null }),
      makeService({ slug: "low", uptime1h: 50 }),
    ];
    const { container } = renderTable(services, { sort: "uptime1h", dir: "asc" });
    const slugs = getOrderedSlugs(container);
    // TanStack Table v8 sortUndefined:"last" applies only to `undefined`, not `null`.
    // null coerces to 0 in numeric comparison → null-uptime rows sort first (smallest).
    expect(slugs[0]).toBe("no-data");
    // low (50) < high (100) in ascending
    expect(slugs.indexOf("low")).toBeLessThan(slugs.indexOf("high"));
  });

  it("sorts names descending when dir=desc", () => {
    const services = [
      makeService({ slug: "a", name: "Alpha" }),
      makeService({ slug: "b", name: "Beta" }),
      makeService({ slug: "c", name: "Gamma" }),
    ];
    const { container } = renderTable(services, { sort: "name", dir: "desc" });
    expect(getOrderedSlugs(container)).toEqual(["c", "b", "a"]);
  });
});

// ── URL parse / filter roundtrip ─────────────────────────────────────────────

describe("SortableServicesTable — URL filter roundtrip", () => {
  it("applies a single category filter from URL, hiding non-matching rows", () => {
    const services = [
      makeService({ slug: "saude-1", category: "saude" }),
      makeService({ slug: "trabalho-1", category: "trabalho" }),
      makeService({ slug: "saude-2", category: "saude" }),
    ];
    const { container } = renderTable(services, { category: "saude" });
    expect(getOrderedSlugs(container)).toEqual(["saude-1", "saude-2"]);
  });

  it("applies a status filter from URL", () => {
    const services = [
      makeService({ slug: "op", status: "operational" }),
      makeService({ slug: "dn", status: "down" }),
    ];
    const { container } = renderTable(services, { status: "down" });
    expect(getOrderedSlugs(container)).toEqual(["dn"]);
  });

  it("applies a sphere filter from URL (pre-filter before TanStack)", () => {
    const services = [
      makeService({ slug: "fed", sphere: "federal" }),
      makeService({ slug: "est", sphere: "estadual" }),
    ];
    const { container } = renderTable(services, { sphere: "estadual" });
    expect(getOrderedSlugs(container)).toEqual(["est"]);
  });

  it("shows the empty-state slot when filters match nothing", () => {
    const { container } = renderTable([makeService({ slug: "a", status: "operational" })], {
      status: "down",
    });
    expect(container.querySelector('[data-slot="sortable-services-empty"]')).not.toBeNull();
    expect(getOrderedSlugs(container)).toEqual([]);
  });

  it("emits a URL update with the toggled sort params when a sort header is clicked", async () => {
    const services = [makeService({ slug: "a" }), makeService({ slug: "b" })];
    const updates: string[] = [];

    // Render with no searchParams: defaults kick in (defaultSortId="name", defaultSortDir="asc"),
    // so "name" is already sorted. Click the unsorted "Status" column instead.
    renderTable(services, {}, (event) => updates.push(event.queryString));

    const user = userEvent.setup();
    // "Status" column is not the default sort → its button aria-label matches "ordenar por Status"
    const statusBtn = screen.getByRole("button", { name: /ordenar por status/i });
    await user.click(statusBtn);

    await waitFor(() => {
      expect(updates.some((q) => q.includes("sort=status"))).toBe(true);
    });
  });
});
