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
  const now = new Date();

  const [rows, serviceRows] = await Promise.all([
    listIncidents(db, { limit: FEED_LIMIT, status: "all" }),
    listServices(db, { activeOnly: false }),
  ]);

  const nameOf = new Map(serviceRows.map((s) => [s.slug, s.name]));
  const feedUpdated =
    rows.length > 0 ? (rows[0]?.startedAt.toISOString() ?? now.toISOString()) : now.toISOString();

  const entries = rows.map((inc) => {
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
    const published = inc.startedAt.toISOString();
    const updated = (inc.endedAt ?? inc.startedAt).toISOString();

    const severityLabel =
      inc.severity === "total" ? "Indisponibilidade total" : "Degradação parcial";
    const parts: string[] = [severityLabel];
    if (inc.statusCode != null) parts.push(`HTTP ${inc.statusCode}`);
    if (inc.errorMessage) parts.push(inc.errorMessage);
    const resolution = inc.endedAt != null ? "Resolvido." : "Em andamento.";
    const summary = `[${svcName}] ${parts.join(" — ")}. ${resolution}`;

    return [
      "  <entry>",
      `    <id>${esc(`${base}/incidentes/${inc.id}`)}</id>`,
      `    <title>${esc(title)}</title>`,
      `    <link href="${esc(link)}"/>`,
      `    <published>${published}</published>`,
      `    <updated>${updated}</updated>`,
      `    <summary>${esc(summary)}</summary>`,
      `    <category term="${esc(inc.serviceSlug)}"/>`,
      "  </entry>",
    ].join("\n");
  });

  const atomUrl = `${base}/atom.xml`;
  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<feed xmlns="http://www.w3.org/2005/Atom">`,
    `  <title>Status Brasil — Incidentes</title>`,
    `  <subtitle>Últimos ${FEED_LIMIT} incidentes nos serviços digitais do governo brasileiro.</subtitle>`,
    `  <link href="${esc(base)}" rel="alternate"/>`,
    `  <link href="${esc(atomUrl)}" rel="self" type="application/atom+xml"/>`,
    `  <id>${esc(atomUrl)}</id>`,
    `  <updated>${feedUpdated}</updated>`,
    `  <generator>StatusBrasil</generator>`,
    ...entries,
    `</feed>`,
  ].join("\n");

  return new Response(xml, {
    status: 200,
    headers: {
      "content-type": "application/atom+xml; charset=utf-8",
      "cache-control": "s-maxage=300, stale-while-revalidate=60",
    },
  });
}
