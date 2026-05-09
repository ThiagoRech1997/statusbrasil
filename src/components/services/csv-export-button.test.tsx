import { render, screen } from "@testing-library/react";
import { useSearchParams } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import ptMessages from "../../../messages/pt.json";
import { CsvExportButton } from "./csv-export-button";

// Factory must not reference outer variables (vi.mock is hoisted above const declarations).
vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

function renderButton(params: Record<string, string> = {}) {
  vi.mocked(useSearchParams).mockReturnValue(
    new URLSearchParams(params) as ReturnType<typeof useSearchParams>,
  );
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <CsvExportButton />
    </NextIntlClientProvider>,
  );
}

function getHref(): string {
  return screen.getByRole("link").getAttribute("href") ?? "";
}

describe("CsvExportButton — URL construction", () => {
  afterEach(() => {
    vi.mocked(useSearchParams).mockReset();
  });

  it("points to the base CSV endpoint when no filters are active", () => {
    renderButton();
    expect(getHref()).toBe("/api/v1/services.csv");
  });

  it("maps the uptime1h column id to sort=uptime", () => {
    renderButton({ sort: "uptime1h" });
    expect(getHref()).toContain("sort=uptime");
    expect(getHref()).not.toContain("sort=uptime1h");
  });

  it("passes sort=name through unchanged", () => {
    renderButton({ sort: "name" });
    expect(getHref()).toContain("sort=name");
  });

  it("passes sort=category through unchanged", () => {
    renderButton({ sort: "category" });
    expect(getHref()).toContain("sort=category");
  });

  it("passes sort=status through unchanged", () => {
    renderButton({ sort: "status" });
    expect(getHref()).toContain("sort=status");
  });

  it("omits sort when the column id has no API mapping (agency)", () => {
    renderButton({ sort: "agency" });
    expect(getHref()).not.toContain("sort=");
  });

  it("passes a single category through", () => {
    renderButton({ category: "saude" });
    expect(getHref()).toContain("category=saude");
  });

  it("omits category when multiple are selected (nuqs serializes as comma-separated)", () => {
    renderButton({ category: "saude,trabalho" });
    expect(getHref()).not.toContain("category=");
  });

  it("passes status through", () => {
    renderButton({ status: "down" });
    expect(getHref()).toContain("status=down");
  });

  it("passes sphere through", () => {
    renderButton({ sphere: "federal" });
    expect(getHref()).toContain("sphere=federal");
  });

  it("combines multiple active filters into the query string", () => {
    renderButton({ sort: "status", status: "degraded", sphere: "estadual" });
    const href = getHref();
    expect(href).toContain("sort=status");
    expect(href).toContain("status=degraded");
    expect(href).toContain("sphere=estadual");
  });

  it("has the download attribute set (browser triggers file download)", () => {
    renderButton();
    expect(screen.getByRole("link")).toHaveAttribute("download");
  });
});
