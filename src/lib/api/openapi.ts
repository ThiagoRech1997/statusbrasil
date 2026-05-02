import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import packageJson from "../../../package.json";
import {
  ApiErrorResponse,
  HistoryQueryParams,
  HistoryResponse,
  HourlyPoint,
  IncidentItem,
  IncidentsQueryParams,
  IncidentsResponse,
  ServiceDetailResponse,
  ServiceItem,
  ServicesQueryParams,
  ServicesResponse,
  Slug,
} from "./schemas";

function buildRegistry(): OpenAPIRegistry {
  const registry = new OpenAPIRegistry();

  const ApiErrorRef = registry.register("ApiErrorResponse", ApiErrorResponse);
  registry.register("ServiceItem", ServiceItem);
  registry.register("IncidentItem", IncidentItem);
  registry.register("HourlyPoint", HourlyPoint);
  const ServicesResponseRef = registry.register("ServicesResponse", ServicesResponse);
  const ServiceDetailResponseRef = registry.register(
    "ServiceDetailResponse",
    ServiceDetailResponse,
  );
  const HistoryResponseRef = registry.register("HistoryResponse", HistoryResponse);
  const IncidentsResponseRef = registry.register("IncidentsResponse", IncidentsResponse);

  const errorJson = (description: string) => ({
    description,
    content: { "application/json": { schema: ApiErrorRef } },
  });

  const slugParam = z.object({ slug: Slug });

  registry.registerPath({
    method: "get",
    path: "/api/v1/services",
    summary: "List services with current status",
    description:
      "Returns a paginated list of services with their latest computed status and 1h uptime.",
    request: { query: ServicesQueryParams },
    responses: {
      200: {
        description: "Page of services",
        content: { "application/json": { schema: ServicesResponseRef } },
      },
      400: errorJson("Invalid query parameters"),
      429: errorJson("Rate limited"),
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/services/{slug}",
    summary: "Get a service with rolling 30d summary",
    description: "Returns service detail plus rolling 30d uptime and last incident.",
    request: { params: slugParam },
    responses: {
      200: {
        description: "Service detail",
        content: { "application/json": { schema: ServiceDetailResponseRef } },
      },
      400: errorJson("Invalid slug"),
      404: errorJson("Service not found"),
      429: errorJson("Rate limited"),
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/services/{slug}/history",
    summary: "Hourly uptime history for a service",
    description:
      "Default range is the last 24h when no params are supplied. Maximum range is 90 days.",
    request: { params: slugParam, query: HistoryQueryParams },
    responses: {
      200: {
        description: "Hourly uptime points within the requested range",
        content: { "application/json": { schema: HistoryResponseRef } },
      },
      400: errorJson("Invalid slug, invalid range, or query parameters"),
      404: errorJson("Service not found"),
      429: errorJson("Rate limited"),
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/v1/incidents",
    summary: "List incidents with optional filters",
    description: "Returns a paginated list of incidents filtered by service, status, and time.",
    request: { query: IncidentsQueryParams },
    responses: {
      200: {
        description: "Page of incidents",
        content: { "application/json": { schema: IncidentsResponseRef } },
      },
      400: errorJson("Invalid query parameters"),
      429: errorJson("Rate limited"),
    },
  });

  const svgResponse = (description: string) => ({
    description,
    content: { "image/svg+xml": { schema: z.string() } },
  });

  registry.registerPath({
    method: "get",
    path: "/api/badge/{slug}/v1.svg",
    summary: "Versioned SVG status badge for a service",
    description:
      "Renders a shields.io-style SVG showing the rolling 30-day uptime for a service. " +
      "Designed for hotlinked <img> embeds (READMEs, status pages); the v1 path is " +
      "schema-locked so the response is served with `Cache-Control: public, max-age=86400, " +
      "immutable`. A bump to /v2.svg is required for any visual schema change. Bucket " +
      "`badge` is rate-limited at 60 req/min/IP independently of the JSON API.",
    request: { params: slugParam },
    responses: {
      200: svgResponse("Badge SVG (immutable for 24h)"),
      400: svgResponse("Invalid slug — returns a fallback 'invalid slug' badge"),
      404: svgResponse("Unknown service — returns a fallback 'unknown' badge"),
      429: svgResponse("Rate limited — returns a fallback 'rate limited' badge"),
      500: svgResponse("Server error — returns a fallback 'error' badge"),
    },
  });

  return registry;
}

export function generateOpenApiSpec(): ReturnType<OpenApiGeneratorV31["generateDocument"]> {
  const registry = buildRegistry();
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "StatusBrasil Public API",
      version: packageJson.version,
      description:
        "Public availability dashboard for Brazilian government services. AGPL-3.0 licensed.",
    },
    servers: [{ url: "/" }],
  });
}
