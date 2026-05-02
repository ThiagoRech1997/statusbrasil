import { describe, expect, it } from "vitest";
import { type BadgeColor, formatBadgeValue, renderBadge, uptimePctToColor } from "./render";

describe("renderBadge", () => {
  it("emits a self-contained SVG with role=img and an aria-label of `label: value`", () => {
    const svg = renderBadge({ label: "uptime", value: "99.7%", color: "brightgreen" });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="uptime: 99.7%"');
    expect(svg).toContain("<title>uptime: 99.7%</title>");
  });

  it("renders the label and value text twice (shadow + foreground) for shields.io look", () => {
    const svg = renderBadge({ label: "uptime", value: "99.7%", color: "brightgreen" });
    expect(svg.match(/>uptime</g)).toHaveLength(2);
    expect(svg.match(/>99\.7%</g)).toHaveLength(2);
  });

  it.each<[BadgeColor, string]>([
    ["brightgreen", "#4c1"],
    ["yellow", "#dfb317"],
    ["red", "#e05d44"],
    ["lightgrey", "#9f9f9f"],
  ])("paints the value segment with the canonical %s hex", (color, hex) => {
    const svg = renderBadge({ label: "uptime", value: "99.7%", color });
    expect(svg).toContain(`fill="${hex}"`);
  });

  it("escapes XML metacharacters in label and value (resists injection via slug)", () => {
    const svg = renderBadge({
      label: "<bad>\"&'`",
      value: "</svg><script>",
      color: "lightgrey",
    });
    expect(svg).not.toContain("<bad>");
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;bad&gt;&quot;&amp;&apos;`");
    expect(svg).toContain("&lt;/svg&gt;&lt;script&gt;");
  });

  it("widens the SVG when text is longer (two segments + padding)", () => {
    const short = renderBadge({ label: "u", value: "1%", color: "brightgreen" });
    const long = renderBadge({ label: "uptime", value: "99.99%", color: "brightgreen" });
    const widthOf = (svg: string) => Number((svg.match(/<svg[^>]+width="(\d+)"/) ?? [])[1]);
    expect(widthOf(long)).toBeGreaterThan(widthOf(short));
  });
});

describe("uptimePctToColor", () => {
  it("buckets uptime by canonical thresholds (≥99 / ≥95 / <95) and falls back on null", () => {
    expect(uptimePctToColor(null)).toBe("lightgrey");
    expect(uptimePctToColor(100)).toBe("brightgreen");
    expect(uptimePctToColor(99)).toBe("brightgreen");
    expect(uptimePctToColor(98.9)).toBe("yellow");
    expect(uptimePctToColor(95)).toBe("yellow");
    expect(uptimePctToColor(94.9)).toBe("red");
    expect(uptimePctToColor(0)).toBe("red");
  });
});

describe("formatBadgeValue", () => {
  it("formats with one decimal and a percent sign; returns 'unknown' for null", () => {
    expect(formatBadgeValue(99.7)).toBe("99.7%");
    expect(formatBadgeValue(100)).toBe("100.0%");
    expect(formatBadgeValue(0)).toBe("0.0%");
    expect(formatBadgeValue(null)).toBe("unknown");
  });
});
