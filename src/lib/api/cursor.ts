import { z } from "zod";

const CursorPayloadSchema = z.object({
  offset: z.number().int().min(0),
});
export type CursorPayload = z.infer<typeof CursorPayloadSchema>;

export class InvalidCursorError extends Error {
  constructor(reason: string) {
    super(`invalid cursor: ${reason}`);
    this.name = "InvalidCursorError";
  }
}

export function encodeCursor(payload: CursorPayload): string {
  const json = JSON.stringify(CursorPayloadSchema.parse(payload));
  return Buffer.from(json, "utf8").toString("base64url");
}

export function decodeCursor(raw: string): CursorPayload {
  let json: string;
  try {
    json = Buffer.from(raw, "base64url").toString("utf8");
  } catch {
    throw new InvalidCursorError("not base64url");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new InvalidCursorError("not json");
  }
  const result = CursorPayloadSchema.safeParse(parsed);
  if (!result.success) throw new InvalidCursorError("malformed payload");
  return result.data;
}
