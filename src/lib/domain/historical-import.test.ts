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
  it("normalizes operational fields while retaining every raw cell", () => {
    const [row] = previewHistoricalCsv('Lead Name,Email,Phone,Event Date,Venue,Lead Source,Estimated Value,Service,Status,Notes\nElena Ruiz,ELENA@example.com,(512) 555-0100,10/24/2026,The Grand Lady,Google,"$1,250.50",Photo Booth,Qualified,Asked about props');
    expect(row.normalizedValues).toMatchObject({ leadName:"Elena Ruiz",firstName:"Elena",lastName:"Ruiz",email:"elena@example.com",phone:"+15125550100",eventDate:"2026-10-24T12:00:00.000Z",venue:"The Grand Lady",leadSource:"Google",estimatedValueCents:125050,service:"Photo Booth",stage:"Qualified",notes:"Asked about props" });
    expect(row.rawValues.Notes).toBe("Asked about props");
  });
  it("does not queue empty service or status cells as invented mappings", () => {
    const [row] = previewHistoricalCsv("Name,Service,Status\nElena,,");
    expect(row.mappingIssues).toEqual([]);
    expect(row.normalizedValues.service).toBeNull();
    expect(row.normalizedValues.stage).toBeNull();
  });
});
