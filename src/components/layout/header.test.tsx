import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "../../../messages/pt.json";
import { Header } from "./header";

function renderHeader() {
  return render(
    <NextIntlClientProvider locale="pt" messages={messages}>
      <Header />
    </NextIntlClientProvider>,
  );
}

describe("Header", () => {
  it("renders the site title linked to home", () => {
    renderHeader();
    const homeLink = screen.getByRole("link", { name: /StatusBrasil/i });
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("renders the primary navigation with translated labels", () => {
    renderHeader();
    const desktopNav = screen.getByRole("navigation", { name: messages.Header.siteTitle });
    const labels = ["Início", "Ranking", "Comparativo", "Incidentes", "Metodologia"];
    for (const label of labels) {
      expect(within(desktopNav).getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("renders the locale switcher and theme toggle controls", () => {
    renderHeader();
    expect(screen.getByRole("navigation", { name: "Idioma" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Alternar tema/i })).toBeInTheDocument();
  });
});
