import { describe, expect, it, vi } from "vitest";
import {
  isMissingLifecycleProjectColumn,
  selectWithLifecycleFallback,
} from "./postgrest-compatibility";

describe("PostgREST schema compatibility", () => {
  it("recognizes only missing additive lifecycle columns", () => {
    expect(
      isMissingLifecycleProjectColumn({
        code: "42703",
        message: "column projects.inquiry_at does not exist",
      }),
    ).toBe(true);
    expect(
      isMissingLifecycleProjectColumn({
        code: "42501",
        message: "permission denied for table projects",
      }),
    ).toBe(false);
  });

  it("retries the project query with the legacy select", async () => {
    const runSelect = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "42703",
          message: "column projects.owner_name does not exist",
        },
      })
      .mockResolvedValueOnce({ data: [{ id: "project-1" }], error: null });

    const result = await selectWithLifecycleFallback(
      "id,inquiry_at,owner_name",
      "id",
      runSelect,
    );

    expect(runSelect).toHaveBeenNthCalledWith(1, "id,inquiry_at,owner_name");
    expect(runSelect).toHaveBeenNthCalledWith(2, "id");
    expect(result).toEqual({ data: [{ id: "project-1" }], error: null });
  });

  it("does not hide unrelated query failures", async () => {
    const failure = {
      data: null,
      error: { code: "42501", message: "permission denied" },
    };
    const runSelect = vi.fn().mockResolvedValue(failure);

    await expect(
      selectWithLifecycleFallback("new", "legacy", runSelect),
    ).resolves.toBe(failure);
    expect(runSelect).toHaveBeenCalledTimes(1);
  });
});
