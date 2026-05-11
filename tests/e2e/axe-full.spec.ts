import { type Page, expect, test } from "@playwright/test";
import { getViolations, injectAxe } from "axe-playwright";

type Theme = "light" | "dark";

const PAGES = [
  { path: "/pt", label: "home" },
  { path: "/pt/ranking", label: "ranking" },
  { path: "/pt/comparativo", label: "comparativo" },
  { path: "/pt/servico/gov-br", label: "servico" },
  { path: "/pt/incidentes", label: "incidentes" },
  { path: "/pt/metodologia", label: "metodologia" },
  { path: "/pt/privacidade", label: "privacidade" },
] as const;

const THEMES: Theme[] = ["light", "dark"];

// Inject localStorage before page scripts run so next-themes picks it up immediately.
async function setTheme(page: Page, theme: Theme) {
  await page.addInitScript((t: string) => {
    try {
      window.localStorage.setItem("theme", t);
    } catch {
      // localStorage unavailable in some contexts — silently ignore
    }
  }, theme);
}

function assertNoHighImpact(
  violations: Awaited<ReturnType<typeof getViolations>>,
  label: string,
  theme: Theme,
) {
  const highImpact = violations.filter((v) => v.impact === "serious" || v.impact === "critical");

  // Log moderate/minor violations as informational — they don't fail the test.
  const lower = violations.filter((v) => v.impact === "moderate" || v.impact === "minor");
  if (lower.length > 0) {
    console.info(
      `[axe-full] ${label} [${theme}] — ${lower.length} minor/moderate (not failing):`,
      lower.map((v) => `${v.id}: ${v.description}`),
    );
  }

  expect(
    highImpact,
    `${label} [${theme}] serious/critical axe violations:\n${JSON.stringify(highImpact, null, 2)}`,
  ).toEqual([]);
}

for (const { path, label } of PAGES) {
  for (const theme of THEMES) {
    test(`[axe] ${label} [${theme}] — zero serious/critical WCAG 2.1 AA violations`, async ({
      page,
    }) => {
      await setTheme(page, theme);
      await page.goto(path);
      await injectAxe(page);

      const violations = await getViolations(page, undefined, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
      });

      assertNoHighImpact(violations, label, theme);
    });
  }
}

// Incident permalink — URL discovered at runtime from the incidents table.
test.describe("[axe] incidente-permalink", () => {
  let permalinkHref: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto("/pt/incidentes");
    const firstLink = page.locator("table tbody tr").first().locator("a").first();
    permalinkHref = await firstLink.getAttribute("href");
    await page.close();
  });

  for (const theme of THEMES) {
    test(`[${theme}] — zero serious/critical WCAG 2.1 AA violations`, async ({ page }) => {
      if (!permalinkHref) {
        test.skip(true, "No incident permalink found in seeded data");
        return;
      }

      await setTheme(page, theme);
      await page.goto(permalinkHref);
      await injectAxe(page);

      const violations = await getViolations(page, undefined, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
      });

      assertNoHighImpact(violations, "incidente-permalink", theme);
    });
  }
});
