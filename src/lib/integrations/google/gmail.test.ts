import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GmailMetadataProvider,
  matchHoneyBookSmsProject,
  parseEmailAddresses,
  parseHoneyBookSmsNotification,
} from "./gmail";

afterEach(() => vi.unstubAllGlobals());

describe("Gmail metadata-only provider", () => {
  it("extracts normalized addresses without message bodies", () =>
    expect(
      parseEmailAddresses("Southern <Hello@Example.COM>, b@example.com"),
    ).toEqual(["hello@example.com", "b@example.com"]));

  it("requests metadata format and returns headers only", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ messages: [{ id: "m1", threadId: "t1" }] }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "m1",
            threadId: "t1",
            internalDate: "1786651200000",
            labelIds: ["SENT"],
            payload: {
              headers: [
                { name: "To", value: "Client <client@example.com>" },
                { name: "Subject", value: "Proposal follow-up" },
              ],
            },
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const [message] = await new GmailMetadataProvider("access").listMetadata();
    expect(message).toMatchObject({
      id: "m1",
      subject: "Proposal follow-up",
      sent: true,
    });
    expect(fetchMock.mock.calls[1][0]).toContain("format=metadata");
  });

  it("recognizes HoneyBook SMS notification subjects only from HoneyBook", () => {
    expect(
      parseHoneyBookSmsNotification(
        "HoneyBook <mailman@honeybook.com>",
        "New SMS from Amanda Atcheson in Amanda Atcheson's Project - Classy Booth",
      ),
    ).toEqual({
      clientName: "Amanda Atcheson",
      projectName: "Amanda Atcheson's Project - Classy Booth",
    });
    expect(
      parseHoneyBookSmsNotification(
        "Someone <spoof@example.com>",
        "New SMS from Amanda Atcheson in Amanda's Project",
      ),
    ).toBeNull();
  });

  it("matches an SMS notification by exact HoneyBook project name", () => {
    expect(
      matchHoneyBookSmsProject(
        [
          {
            id: "project-1",
            name: "Amanda Atcheson’s Project - Classy Booth",
            contacts: {
              first_name: "Amanda",
              last_name: "Atcheson",
            },
          },
        ],
        {
          clientName: "Amanda Atcheson",
          projectName: "Amanda Atcheson's Project - Classy Booth",
        },
      ),
    ).toBe("project-1");
  });

  it("does not guess when a client name has multiple projects", () => {
    expect(
      matchHoneyBookSmsProject(
        [
          {
            id: "project-1",
            name: "First event",
            contacts: {
              first_name: "Amanda",
              last_name: "Atcheson",
            },
          },
          {
            id: "project-2",
            name: "Second event",
            contacts: {
              first_name: "Amanda",
              last_name: "Atcheson",
            },
          },
        ],
        {
          clientName: "Amanda Atcheson",
          projectName: "Unknown project",
        },
      ),
    ).toBeNull();
  });
});
