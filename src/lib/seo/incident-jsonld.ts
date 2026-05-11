export interface IncidentJsonLdInput {
  siteUrl: string;
  locale: string;
  incidentId: string;
  /** Localized event name, e.g. "Incidente em Meu INSS" */
  eventName: string;
  /** Description of the incident for schema.org */
  description: string;
  service: {
    slug: string;
    name: string;
    agency: string;
    url: string;
  };
  startedAt: Date;
  endedAt: Date | null;
}

export interface IncidentJsonLdGraph {
  "@context": "https://schema.org";
  "@type": "Event";
  "@id": string;
  name: string;
  description: string;
  startDate: string;
  endDate?: string;
  eventStatus: string;
  eventAttendanceMode: string;
  location: VirtualLocation;
  organizer: GovernmentOrganization;
  url: string;
  inLanguage: string;
}

interface VirtualLocation {
  "@type": "VirtualLocation";
  url: string;
}

interface GovernmentOrganization {
  "@type": "GovernmentOrganization";
  name: string;
}

const EVENT_STATUS_CANCELLED = "https://schema.org/EventCancelled";
const EVENT_STATUS_SCHEDULED = "https://schema.org/EventScheduled";
const ONLINE_ATTENDANCE = "https://schema.org/OnlineEventAttendanceMode";

export function buildIncidentJsonLd(input: IncidentJsonLdInput): IncidentJsonLdGraph {
  const siteUrl = input.siteUrl.replace(/\/+$/, "");
  const incidentUrl = `${siteUrl}/${input.locale}/incidentes/${input.incidentId}`;
  const isClosed = input.endedAt != null;

  const graph: IncidentJsonLdGraph = {
    "@context": "https://schema.org",
    "@type": "Event",
    "@id": `${incidentUrl}#event`,
    name: input.eventName,
    description: input.description,
    startDate: input.startedAt.toISOString(),
    eventStatus: isClosed ? EVENT_STATUS_CANCELLED : EVENT_STATUS_SCHEDULED,
    eventAttendanceMode: ONLINE_ATTENDANCE,
    location: {
      "@type": "VirtualLocation",
      url: input.service.url,
    },
    organizer: {
      "@type": "GovernmentOrganization",
      name: input.service.agency,
    },
    url: incidentUrl,
    inLanguage: input.locale,
  };

  if (isClosed && input.endedAt) {
    graph.endDate = input.endedAt.toISOString();
  }

  return graph;
}
