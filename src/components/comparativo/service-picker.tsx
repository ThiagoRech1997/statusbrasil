"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsArrayOf, parseAsString, useQueryState } from "nuqs";
import { useEffect, useRef, useState } from "react";
import type { ServiceRow } from "@/lib/queries/services";

const MAX_SERVICES = 4;

export interface ServicePickerProps {
  allServices: ServiceRow[];
}

export function ServicePicker({ allServices }: ServicePickerProps) {
  const t = useTranslations("Comparativo");
  const [selectedSlugs, setSelectedSlugs] = useQueryState(
    "services",
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = "service-picker-listbox";

  const selectedServices = selectedSlugs
    .map((slug) => allServices.find((s) => s.slug === slug))
    .filter((s): s is ServiceRow => s != null);

  const atMax = selectedSlugs.length >= MAX_SERVICES;

  const filteredOptions = allServices
    .filter((s) => !selectedSlugs.includes(s.slug))
    .filter(
      (s) =>
        search === "" ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.agency.toLowerCase().includes(search.toLowerCase()),
    )
    .slice(0, 8);

  const addService = (slug: string) => {
    if (atMax) return;
    setSelectedSlugs([...selectedSlugs, slug]);
    setSearch("");
    inputRef.current?.focus();
  };

  const removeService = (slug: string) => {
    setSelectedSlugs(selectedSlugs.filter((s) => s !== slug));
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div
      ref={containerRef}
      data-slot="service-picker"
      className="flex flex-col gap-2"
      aria-label={t("picker.label")}
    >
      {/* Selected chips */}
      {selectedServices.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("picker.label")}>
          {selectedServices.map((svc, idx) => {
            const color = SERVICE_COLORS[idx] ?? SERVICE_COLORS[0];
            return (
              <span
                key={svc.slug}
                className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-sm ring-1 ring-border"
              >
                <span
                  aria-hidden
                  className="inline-block size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="max-w-[14ch] truncate font-medium">{svc.name}</span>
                <button
                  type="button"
                  aria-label={t("picker.removeService", { name: svc.name })}
                  onClick={() => removeService(svc.slug)}
                  className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X size={12} aria-hidden />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Search input + dropdown */}
      <div className="relative">
        <div
          className={`flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 focus-within:ring-2 focus-within:ring-ring ${atMax ? "opacity-60" : ""}`}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className="shrink-0 text-muted-foreground"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            disabled={atMax}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
                setSearch("");
              }
            }}
            placeholder={atMax ? t("picker.maxReached") : t("picker.placeholder")}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {selectedSlugs.length > 0 && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {t("picker.selected", { count: selectedSlugs.length })}
            </span>
          )}
        </div>

        {open && !atMax && (
          <ul
            id={listId}
            role="listbox"
            aria-label={t("picker.label")}
            className="absolute top-full z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-popover shadow-md"
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2.5 text-sm text-muted-foreground">{t("picker.noResults")}</li>
            ) : (
              filteredOptions.map((svc) => (
                <li key={svc.slug} role="option" aria-selected={false}>
                  <button
                    type="button"
                    className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                    onClick={() => {
                      addService(svc.slug);
                      setOpen(filteredOptions.length > 1);
                    }}
                  >
                    <span className="text-sm font-medium">{svc.name}</span>
                    <span className="text-xs text-muted-foreground">{svc.agency}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {selectedSlugs.length < 2 && (
        <p className="text-xs text-muted-foreground">{t("picker.selectHint")}</p>
      )}
    </div>
  );
}

// Mirror SERIES_COLORS from multi-latency-chart so chips match chart lines
const SERVICE_COLORS = ["#3b82f6", "#f97316", "#22c55e", "#d946ef"] as const;
