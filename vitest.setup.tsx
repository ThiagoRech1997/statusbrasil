import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

afterEach(() => {
  cleanup();
});

vi.mock("@/i18n/navigation", () => {
  const Link = ({
    href,
    locale: _locale,
    children,
    ...props
  }: ComponentProps<"a"> & { href: string; locale?: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
  return {
    Link,
    redirect: vi.fn(),
    usePathname: () => "/",
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
    }),
    getPathname: ({ href }: { href: string }) => href,
  };
});
