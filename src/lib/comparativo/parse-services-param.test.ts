import { describe, expect, it } from "vitest";
import {
  MAX_COMPARATIVO_SERVICES,
  MIN_COMPARATIVO_SERVICES,
  parseServicesParam,
} from "./parse-services-param";

describe("parseServicesParam", () => {
  it("returns [] for undefined", () => {
    expect(parseServicesParam(undefined)).toEqual([]);
  });

  it("returns [] for an empty string", () => {
    expect(parseServicesParam("")).toEqual([]);
  });

  it("splits a valid comma-separated list", () => {
    expect(parseServicesParam("receita-federal,meu-inss")).toEqual(["receita-federal", "meu-inss"]);
  });

  it("trims whitespace around each slug", () => {
    expect(parseServicesParam(" receita-federal , meu-inss ")).toEqual([
      "receita-federal",
      "meu-inss",
    ]);
  });

  it("filters out empty entries produced by double commas", () => {
    expect(parseServicesParam("receita-federal,,meu-inss")).toEqual([
      "receita-federal",
      "meu-inss",
    ]);
  });

  it("caps results at MAX_COMPARATIVO_SERVICES (4)", () => {
    const result = parseServicesParam("a,b,c,d,e");
    expect(result).toHaveLength(MAX_COMPARATIVO_SERVICES);
    expect(result).toEqual(["a", "b", "c", "d"]);
  });

  it("returns all slugs when exactly at MAX_COMPARATIVO_SERVICES", () => {
    expect(parseServicesParam("a,b,c,d")).toEqual(["a", "b", "c", "d"]);
  });

  it("returns both slugs when exactly at MIN_COMPARATIVO_SERVICES", () => {
    expect(parseServicesParam("a,b")).toHaveLength(MIN_COMPARATIVO_SERVICES);
  });

  it("returns a single slug (below MIN — caller must enforce the minimum)", () => {
    expect(parseServicesParam("only-one")).toEqual(["only-one"]);
  });

  it("preserves slug order", () => {
    expect(parseServicesParam("gov-br,detran-sp,receita-federal")).toEqual([
      "gov-br",
      "detran-sp",
      "receita-federal",
    ]);
  });

  it("exports MIN=2 and MAX=4", () => {
    expect(MIN_COMPARATIVO_SERVICES).toBe(2);
    expect(MAX_COMPARATIVO_SERVICES).toBe(4);
  });
});
