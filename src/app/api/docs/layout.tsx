import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import "@scalar/api-reference-react/style.css";

export const metadata: Metadata = {
  title: "API Reference · StatusBrasil",
  description: "Public OpenAPI 3.1 reference for the StatusBrasil API.",
};

export default function ApiDocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
