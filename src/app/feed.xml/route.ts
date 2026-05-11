import { db } from "@/lib/db";
import { formatDowntimeDuration } from "@/lib/editorial/downtime";
import { listIncidents } from "@/lib/queries/incidents";
import { listServices } from "@/lib/queries/services";

export const runtime = "nodejs";

const FEED_LIMIT = 50;
const DEFAULT_LOCALE = "pt";

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDuration(seconds: number): string {
  return formatDowntimeDuration(DEFAULT_LOCALE, seconds);
}

export async function GET(): Promise<Response> {
  const base = siteUrl();

  const [rows, serviceRows] = await Promise.all([
    listIncidents(db, { limit: FEED_LIMIT, status: "all" }),
    listServices(db, { activeOnly: false }),
  ]);

  const nameOf = new Map(serviceRows.map((s) => [s.slug, s.name]));
  const lastBuildDate = new Date().toUTCString();

  const items = rows.map((inc) => {
    const svcName = nameOf.get(inc.serviceSlug) ?? inc.serviceSlug;

    const durationSeconds =
      inc.durationSeconds ??
      (inc.endedAt != null
        ? Math.round((inc.endedAt.getTime() - inc.startedAt.getTime()) / 1000)
        : null);

    const durationLabel =
      durationSeconds != null && durationSeconds > 0
        ? fmtDuration(durationSeconds)
        : inc.endedAt == null
          ? "em andamento"
          : "—";

    const title = `${svcName} — ${durationLabel}`;
    const link = `${base}/${DEFAULT_LOCALE}/incidentes/${inc.id}`;
    const pubDate = inc.startedAt.toUTCString();

    const severityLabel =
      inc.severity === "total" ? "Indisponibilidade total" : "Degradação parcial";
    const parts: string[] = [severityLabel];
    if (inc.statusCode != null) parts.push(`HTTP ${inc.statusCode}`);
    if (inc.errorMessage) parts.push(inc.errorMessage);
    const resolution = inc.endedAt != null ? "Resolvido." : "Em andamento.";
    const description = `[${svcName}] ${parts.join(" — ")}. ${resolution}`;

    return [
      "    <item>",
      `      <title>${esc(title)}</title>`,
      `      <link>${esc(link)}</link>`,
      `      <guid isPermaLink="false">${esc(inc.id)}</guid>`,
      `      <pubDate>${pubDate}</pubDate>`,
      `      <description>${esc(description)}</description>`,
      `      <category>${esc(inc.serviceSlug)}</category>`,
      "    </item>",
    ].join("\n");
  });

  const feedUrl = `${base}/feed.xml`;
  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">`,
    `  <channel>`,
    `    <title>Status Brasil — Incidentes</title>`,
    `    <link>${esc(base)}</link>`,
    `    <description>Últimos ${FEED_LIMIT} incidentes nos serviços digitais do governo brasileiro.</description>`,
    `    <language>pt-BR</language>`,
    `    <lastBuildDate>${lastBuildDate}</lastBuildDate>`,
    `    <generator>StatusBrasil</generator>`,
    `    <atom:link href="${esc(feedUrl)}" rel="self" type="application/rss+xml"/>`,
    ...items,
    `  </channel>`,
    `</rss>`,
  ].join("\n");

  return new Response(xml, {
    status: 200,
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "s-maxage=300, stale-while-revalidate=60",
    },
  });
}
