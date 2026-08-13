import { describe, expect, it } from "vitest";
import { parseCsv, previewHistoricalCsv } from "./historical-import";

describe("historical import", () => {
  it("parses quoted cells and line breaks", () => {
    expect(parseCsv('Name,Notes\r\n"Ruiz, Elena","Called, no answer"')).toEqual([["Name","Notes"],["Ruiz, Elena","Called, no answer"]]);
  });
  it("preserves raw values and queues ambiguous mappings", () => {
    const [row] = previewHistoricalCsv("Name,Service Requested,Booking Status\nElena,Party Deluxe,Maybe");
    expect(row.rawValues["Service Requested"]).toBe("Party Deluxe");
    expect(row.mappingIssues).toHaveLength(2);
  });
  it("creates stable fingerprints for duplicate import prevention", () => {
    const csv = "Name,Service,Status\nElena,Photo Booth,Inquiry";
    expect(previewHistoricalCsv(csv)[0].fingerprint).toBe(previewHistoricalCsv(csv)[0].fingerprint);
  });
});
