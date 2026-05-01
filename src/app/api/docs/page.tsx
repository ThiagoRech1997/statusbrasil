import { ScalarReference } from "./scalar-reference";

export const dynamic = "force-static";

export default function ApiDocsPage() {
  return <ScalarReference specUrl="/api/openapi.json" />;
}
