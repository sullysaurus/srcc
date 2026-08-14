import { describe,expect,it } from "vitest";
import { addDaysToDateKey,dateKeyInTimeZone,startOfDateInTimeZone } from "./dates";

describe("organization timezone dates",()=>{
  it("keeps the Central business date before UTC midnight rollover",()=>{
    expect(dateKeyInTimeZone(new Date("2026-08-14T01:30:00Z"),"America/Chicago")).toBe("2026-08-13");
  });
  it("calculates Central midnight across daylight-saving boundaries",()=>{
    expect(startOfDateInTimeZone("2026-03-08","America/Chicago")).toBe("2026-03-08T06:00:00.000Z");
    expect(startOfDateInTimeZone("2026-11-01","America/Chicago")).toBe("2026-11-01T05:00:00.000Z");
  });
  it("advances calendar dates rather than fixed 24-hour windows",()=>{
    expect(addDaysToDateKey("2026-03-08",1)).toBe("2026-03-09");
  });
});
