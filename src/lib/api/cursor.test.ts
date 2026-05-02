import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor, InvalidCursorError } from "./cursor";

describe("cursor codec", () => {
  it("round-trips an offset payload", () => {
    const encoded = encodeCursor({ offset: 50 });
    expect(typeof encoded).toBe("string");
    expect(decodeCursor(encoded)).toEqual({ offset: 50 });
  });

  it("rejects a non-base64url string", () => {
    expect(() => decodeCursor("$$$not-base64$$$")).toThrow(InvalidCursorError);
  });

  it("rejects valid base64url that is not JSON", () => {
    const garbage = Buffer.from("not json", "utf8").toString("base64url");
    expect(() => decodeCursor(garbage)).toThrow(InvalidCursorError);
  });

  it("rejects JSON that does not match the payload shape", () => {
    const wrong = Buffer.from(JSON.stringify({ foo: "bar" }), "utf8").toString("base64url");
    expect(() => decodeCursor(wrong)).toThrow(InvalidCursorError);
  });

  it("rejects a negative offset", () => {
    expect(() => encodeCursor({ offset: -1 })).toThrow();
  });
});
