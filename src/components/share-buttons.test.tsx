import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import enMessages from "../../messages/en.json";
import ptMessages from "../../messages/pt.json";
import { ShareButtons } from "./share-buttons";

const PAGE_URL = "https://statusbrasil.org/servico/receita-federal";
const SERVICE = "Receita Federal";

function renderShare(
  props: Partial<React.ComponentProps<typeof ShareButtons>> = {},
  locale: "pt" | "en" = "pt",
) {
  const messages = locale === "pt" ? ptMessages : enMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <ShareButtons url={PAGE_URL} serviceName={SERVICE} {...props} />
    </NextIntlClientProvider>,
  );
}

describe("ShareButtons", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders the three share controls inside a labelled group", () => {
    renderShare();
    const group = screen.getByRole("group", { name: "Compartilhar" });
    expect(
      within(group).getByRole("link", { name: "Compartilhar no Twitter" }),
    ).toBeInTheDocument();
    expect(
      within(group).getByRole("link", { name: "Compartilhar no Bluesky" }),
    ).toBeInTheDocument();
    expect(
      within(group).getByRole("button", { name: "Copiar link da página" }),
    ).toBeInTheDocument();
  });

  it("builds a Twitter intent URL with the service text and the URL encoded", () => {
    renderShare();
    const link = screen.getByRole("link", { name: "Compartilhar no Twitter" });
    const href = link.getAttribute("href") ?? "";
    expect(href.startsWith("https://twitter.com/intent/tweet?")).toBe(true);
    const params = new URL(href).searchParams;
    expect(params.get("text")).toBe("Status atual de Receita Federal no StatusBrasil");
    expect(params.get("url")).toBe(PAGE_URL);
  });

  it("builds a Bluesky compose URL embedding URL inline since intent only takes `text`", () => {
    renderShare();
    const href =
      screen.getByRole("link", { name: "Compartilhar no Bluesky" }).getAttribute("href") ?? "";
    expect(href.startsWith("https://bsky.app/intent/compose?")).toBe(true);
    const text = new URL(href).searchParams.get("text") ?? "";
    expect(text).toContain("Receita Federal");
    expect(text).toContain(PAGE_URL);
    // Bluesky intent must NOT have a `url` param — text is the only field it accepts.
    expect(new URL(href).searchParams.get("url")).toBeNull();
  });

  it("opens external links in a new tab with rel=noopener", () => {
    renderShare();
    for (const name of ["Compartilhar no Twitter", "Compartilhar no Bluesky"]) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("rel") ?? "").toContain("noopener");
    }
  });

  it("uses a custom `text` prop verbatim when supplied", () => {
    renderShare({ text: "Custom share text" });
    const params = new URL(
      screen.getByRole("link", { name: "Compartilhar no Twitter" }).getAttribute("href") ?? "",
    ).searchParams;
    expect(params.get("text")).toBe("Custom share text");
  });

  it("calls navigator.clipboard.writeText with the URL on copy", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    renderShare();

    fireEvent.click(screen.getByRole("button", { name: "Copiar link da página" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(PAGE_URL));
  });

  it("announces the success state via the aria-live region after copy", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    renderShare();

    expect(screen.getByRole("status").textContent).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Copiar link da página" }));

    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Link copiado"));
    // The visible button label also flips to the copied copy.
    expect(screen.getByRole("button", { name: "Copiar link da página" })).toHaveAttribute(
      "data-feedback",
      "copied",
    );
  });

  it("clears the feedback after the timeout", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    renderShare();

    fireEvent.click(screen.getByRole("button", { name: "Copiar link da página" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Link copiado"));

    vi.advanceTimersByTime(2600);
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(""));
  });

  it("falls back to document.execCommand('copy') when navigator.clipboard is unavailable", async () => {
    vi.stubGlobal("navigator", {});
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      value: execCommand,
      configurable: true,
      writable: true,
    });

    renderShare();
    fireEvent.click(screen.getByRole("button", { name: "Copiar link da página" }));

    await waitFor(() => expect(execCommand).toHaveBeenCalledWith("copy"));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Link copiado"));
  });

  it("reports failure when both clipboard APIs error out", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    Object.defineProperty(document, "execCommand", {
      value: vi.fn().mockReturnValue(false),
      configurable: true,
      writable: true,
    });

    renderShare();
    fireEvent.click(screen.getByRole("button", { name: "Copiar link da página" }));

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        "Não foi possível copiar — copie manualmente",
      ),
    );
  });

  it("uses EN labels and default share text when locale=en", () => {
    renderShare({}, "en");
    expect(screen.getByRole("group", { name: "Share" })).toBeInTheDocument();
    const params = new URL(
      screen.getByRole("link", { name: "Share on Twitter" }).getAttribute("href") ?? "",
    ).searchParams;
    expect(params.get("text")).toBe("Current status of Receita Federal on StatusBrasil");
  });
});
