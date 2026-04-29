"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const ORDER = ["light", "dark", "system"] as const;
type ThemeName = (typeof ORDER)[number];

const ICONS: Record<ThemeName, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const t = useTranslations("Header.themeToggle");

  useEffect(() => {
    setMounted(true);
  }, []);

  const current = (mounted ? (theme as ThemeName) : "system") ?? "system";
  const Icon = ICONS[current] ?? Monitor;
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length] ?? "system";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      aria-label={`${t("label")}: ${t(current)} → ${t(next)}`}
      title={t(current)}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </Button>
  );
}
