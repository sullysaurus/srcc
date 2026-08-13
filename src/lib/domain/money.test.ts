import { describe, expect, it } from "vitest";
import { dollarsToCents } from "./money";

describe("currency handling", () => {
  it("converts dollars to integer cents without floating point math", () => {
    expect(dollarsToCents("$1,234.56")).toBe(123456);
    expect(dollarsToCents("18.9")).toBe(1890);
  });

  it("rejects fractions smaller than a cent", () => {
    expect(() => dollarsToCents("12.345")).toThrow();
  });
});
