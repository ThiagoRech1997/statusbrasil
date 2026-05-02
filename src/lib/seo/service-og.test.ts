import { describe, expect, it } from "vitest";
import {
  buildServiceOgContent,
  formatOgUptime,
  type OgServiceStatus,
  statusAccentHex,
} from "./service-og";

describe("statusAccentHex", () => {
  it.each<[OgServiceStatus, string]>([
    ["operational", "#4ade80"],
    ["degraded", "#facc15"],
    ["down", "#f87171"],
    ["unknown", "#94a3b8"],
  ])("maps %s to %s (theme-independent hex)", (status, hex) => {
    expect(statusAccentHex(status)).toBe(hex);
  });
});

describe("formatOgUptime", () => {
  it("formats with one decimal and returns null on missing data", () => {
    expect(formatOgUptime(99.7)).toBe("99.7%");
    expect(formatOgUptime(100)).toBe("100.0%");
    expect(formatOgUptime(0)).toBe("0.0%");
    expect(formatOgUptime(null)).toBeNull();
  });

  it("uses dot decimals (intentionally locale-neutral for OG cards)", () => {
    expect(formatOgUptime(95.45)).toBe("95.5%");
    expect(formatOgUptime(95.45)).not.toContain(",");
  });
});

describe("buildServiceOgContent", () => {
  it("passes service/agency through and computes accent + uptime text", () => {
    const out = buildServiceOgContent({
      serviceName: "Receita Federal",
      agency: "Receita Federal do Brasil",
      status: "operational",
      uptimePct30d: 99.7,
    });
    expect(out).toEqual({
      serviceName: "Receita Federal",
      agency: "Receita Federal do Brasil",
      status: "operational",
      accentHex: "#4ade80",
      uptimeText: "99.7%",
    });
  });

  it("uses the unknown accent and null uptime when no data is available", () => {
    const out = buildServiceOgContent({
      serviceName: "Novo Serviço",
      agency: "Agência X",
      status: "unknown",
      uptimePct30d: null,
    });
    expect(out.accentHex).toBe("#94a3b8");
    expect(out.uptimeText).toBeNull();
  });

  it("paints down services red even when uptime is reportedly 0", () => {
    const out = buildServiceOgContent({
      serviceName: "X",
      agency: "Y",
      status: "down",
      uptimePct30d: 0,
    });
    expect(out.accentHex).toBe("#f87171");
    expect(out.uptimeText).toBe("0.0%");
  });
});
