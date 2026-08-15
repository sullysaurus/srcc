import { describe, expect, it } from "vitest";

import { displayProjectName } from "./project-display";

describe("project display names", () => {
  it("removes HoneyBook's default possessive project suffix", () => {
    expect(displayProjectName("Sydney Nevarez's Project")).toBe(
      "Sydney Nevarez",
    );
    expect(displayProjectName("Sydney Nevarez’s Project")).toBe(
      "Sydney Nevarez",
    );
    expect(displayProjectName("Amanda Atcheson's Project - Classy Booth")).toBe(
      "Amanda Atcheson",
    );
  });

  it("preserves intentionally named projects", () => {
    expect(displayProjectName("The Nevarez Wedding Project")).toBe(
      "The Nevarez Wedding Project",
    );
  });
});
