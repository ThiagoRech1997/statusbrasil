"use client";

import { Download } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Map TanStack Table column IDs to CSV API sort values.
const SORT_MAP: Record<string, string> = {
  uptime1h: "uptime",
  name: "name",
  category: "category",
  status: "status",
};

export function CsvExportButton({ className }: { className?: string }) {
  const t = useTranslations("Ranking");
  const searchParams = useSearchParams();

  const sort = searchParams.get("sort");
  // nuqs parseAsArrayOf serialises as comma-separated in a single param
  const categoryRaw = searchParams.get("category");
  const categories = categoryRaw ? categoryRaw.split(",").filter(Boolean) : [];
  const status = searchParams.get("status");
  const sphere = searchParams.get("sphere");

  const params = new URLSearchParams();
  if (sort && SORT_MAP[sort]) params.set("sort", SORT_MAP[sort]);
  // CSV accepts a single category; omit when multiple are selected
  if (categories.length === 1 && categories[0]) params.set("category", categories[0]);
  if (status) params.set("status", status);
  if (sphere) params.set("sphere", sphere);

  const query = params.size > 0 ? `?${params.toString()}` : "";
  const href = `/api/v1/services.csv${query}`;

  return (
    <a
      href={href}
      download
      className={cn(buttonVariants({ variant: "outline", size: "sm" }), className)}
    >
      <Download aria-hidden className="size-3.5" />
      {t("exportCsv")}
    </a>
  );
}
