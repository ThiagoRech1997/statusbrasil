import { describe, expect, it } from "vitest";
import { formatDowntimeDuration, summarizeDowntime } from "./downtime";

const SERVICES = [
  { slug: "rf", name: "Receita Federal" },
  { slug: "inss", name: "Meu INSS" },
  { slug: "fgts", name: "FGTS" },
];

describe("summarizeDowntime", () => {
  it("returns zero total and null worst when there is no downtime", () => {
    expect(summarizeDowntime({}, SERVICES)).toEqual({ totalSeconds: 0, worst: null });
  });

  it("ignores services with non-positive seconds", () => {
    const result = summarizeDowntime({ rf: 0, inss: -10, fgts: 600 }, SERVICES);
    expect(result.totalSeconds).toBe(600);
    expect(result.worst?.slug).toBe("fgts");
  });

  it("sums all positive entries into totalSeconds", () => {
    const result = summarizeDowntime({ rf: 600, inss: 1200, fgts: 3000 }, SERVICES);
    expect(result.totalSeconds).toBe(4800);
  });

  it("picks the service with the most downtime as worst", () => {
    const result = summarizeDowntime({ rf: 600, inss: 12000, fgts: 3000 }, SERVICES);
    expect(result.worst).toEqual({ slug: "inss", name: "Meu INSS", seconds: 12000 });
  });

  it("breaks ties on max downtime alphabetically by name", () => {
    const result = summarizeDowntime({ rf: 1800, inss: 1800, fgts: 1800 }, SERVICES);
    expect(result.worst?.slug).toBe("fgts");
  });

  it("still counts a slug missing from `services` toward the total but does not pick it as worst", () => {
    const result = summarizeDowntime({ ghost: 7200, rf: 600 }, SERVICES);
    expect(result.totalSeconds).toBe(7800);
    expect(result.worst?.slug).toBe("rf");
  });
});

describe("formatDowntimeDuration", () => {
  it("returns the empty string for zero or negative seconds", () => {
    expect(formatDowntimeDuration("pt", 0)).toBe("");
    expect(formatDowntimeDuration("pt", -100)).toBe("");
  });

  it("renders sub-minute durations as a 1-minute floor (PT)", () => {
    expect(formatDowntimeDuration("pt", 30)).toBe("1 minuto");
  });

  it("renders only minutes when under one hour (PT)", () => {
    expect(formatDowntimeDuration("pt", 12 * 60)).toBe("12 minutos");
  });

  it("renders hours-only when minutes round to zero (PT)", () => {
    expect(formatDowntimeDuration("pt", 5 * 60 * 60)).toBe("5 horas");
  });

  it("renders hours and minutes joined by 'e' (PT)", () => {
    expect(formatDowntimeDuration("pt", 3 * 60 * 60 + 22 * 60)).toBe("3 horas e 22 minutos");
  });

  it("renders hours and minutes joined by 'and' (EN)", () => {
    expect(formatDowntimeDuration("en", 3 * 60 * 60 + 22 * 60)).toBe("3 hours and 22 minutes");
  });

  it("uses the singular unit form for one hour / one minute (PT)", () => {
    expect(formatDowntimeDuration("pt", 60 * 60 + 60)).toBe("1 hora e 1 minuto");
  });
});
