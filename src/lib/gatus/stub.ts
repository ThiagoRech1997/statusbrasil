import "server-only";

import type { GatusClient } from "./client";
import type { EndpointResult, EndpointStatus } from "./schemas";

const HISTORY_SIZE = 12;
const HOUR_MS = 60 * 60 * 1000;
const NS_PER_MS = 1_000_000;

type Fixture = {
  name: string;
  group: string;
  key: string;
  hostname: string;
  baseDurationMs: number;
  outage?: { lastN: number; status: number; error: string };
  flaky?: { everyN: number };
};

const FIXTURES: readonly Fixture[] = [
  {
    name: "Receita Federal",
    group: "federal",
    key: "federal_receita",
    hostname: "servicos.receita.fazenda.gov.br",
    baseDurationMs: 220,
  },
  {
    name: "Meu INSS",
    group: "federal",
    key: "federal_meu_inss",
    hostname: "meu.inss.gov.br",
    baseDurationMs: 1180,
    flaky: { everyN: 4 },
  },
  {
    name: "e-CAC",
    group: "federal",
    key: "federal_e_cac",
    hostname: "cav.receita.fazenda.gov.br",
    baseDurationMs: 310,
  },
  {
    name: "gov.br",
    group: "federal",
    key: "federal_gov_br",
    hostname: "www.gov.br",
    baseDurationMs: 180,
  },
  {
    name: "ConecteSUS",
    group: "federal",
    key: "federal_conecte_sus",
    hostname: "conectesus.saude.gov.br",
    baseDurationMs: 410,
    outage: { lastN: 3, status: 503, error: "service unavailable" },
  },
  {
    name: "FGTS",
    group: "federal",
    key: "federal_fgts",
    hostname: "www.fgts.gov.br",
    baseDurationMs: 260,
  },
];

function buildResult(fixture: Fixture, hoursAgo: number, now: number): EndpointResult {
  const jitterMs = ((hoursAgo * 37) % 50) - 25;
  const timestamp = new Date(now - hoursAgo * HOUR_MS).toISOString();

  const { outage, flaky } = fixture;

  if (outage && hoursAgo < outage.lastN) {
    return {
      status: outage.status,
      hostname: fixture.hostname,
      duration: (fixture.baseDurationMs + jitterMs + 800) * NS_PER_MS,
      errors: [outage.error],
      conditionResults: [
        { condition: "[STATUS] == 200", success: false },
        { condition: "[RESPONSE_TIME] < 1000", success: false },
      ],
      success: false,
      timestamp,
    };
  }

  if (flaky && hoursAgo > 0 && hoursAgo % flaky.everyN === 0) {
    return {
      status: 200,
      hostname: fixture.hostname,
      duration: (fixture.baseDurationMs + jitterMs + 800) * NS_PER_MS,
      errors: [],
      conditionResults: [
        { condition: "[STATUS] == 200", success: true },
        { condition: "[RESPONSE_TIME] < 1000", success: false },
      ],
      success: false,
      timestamp,
    };
  }

  return {
    status: 200,
    hostname: fixture.hostname,
    duration: (fixture.baseDurationMs + jitterMs) * NS_PER_MS,
    errors: [],
    conditionResults: [
      { condition: "[STATUS] == 200", success: true },
      { condition: "[RESPONSE_TIME] < 1000", success: true },
    ],
    success: true,
    timestamp,
  };
}

export function createStubGatusClient(): GatusClient {
  return {
    async listEndpointStatuses(): Promise<EndpointStatus[]> {
      const now = Date.now();
      return FIXTURES.map((fixture) => ({
        name: fixture.name,
        group: fixture.group,
        key: fixture.key,
        results: Array.from({ length: HISTORY_SIZE }, (_, i) =>
          buildResult(fixture, HISTORY_SIZE - 1 - i, now),
        ),
        events: [],
      }));
    },
  };
}
