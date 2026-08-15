import { z } from "zod";
import { providerFetch } from "./http";
const listSchema = z.object({
  messages: z
    .array(z.object({ id: z.string(), threadId: z.string() }))
    .default([]),
  nextPageToken: z.string().optional(),
});
const messageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  internalDate: z.string(),
  labelIds: z.array(z.string()).default([]),
  payload: z.object({
    headers: z
      .array(z.object({ name: z.string(), value: z.string() }))
      .default([]),
  }),
});
const profileSchema = z.object({
  emailAddress: z.string().email(),
  historyId: z.string(),
});
export type GmailMetadata = {
  id: string;
  threadId: string;
  occurredAt: string;
  from: string | null;
  to: string | null;
  subject: string | null;
  externalMessageId: string | null;
  sent: boolean;
};
export class GmailMetadataProvider {
  constructor(private readonly accessToken: string) {}
  private headers() {
    return { authorization: `Bearer ${this.accessToken}` };
  }
  async profile() {
    const response = await providerFetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      { headers: this.headers() },
      "gmail",
    );
    return profileSchema.parse(await response.json());
  }
  async listMetadata(afterEpochSeconds?: number) {
    const messages: Array<{ id: string; threadId: string }> = [];
    let pageToken: string | undefined;
    do {
      const url = new URL(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages",
      );
      url.searchParams.set("maxResults", "100");
      if (afterEpochSeconds)
        url.searchParams.set("q", `after:${afterEpochSeconds}`);
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const response = await providerFetch(
        url.toString(),
        { headers: this.headers() },
        "gmail",
      );
      const page = listSchema.parse(await response.json());
      messages.push(...page.messages);
      pageToken = page.nextPageToken;
    } while (pageToken && messages.length < 1000);
    const output: GmailMetadata[] = [];
    for (const message of messages) {
      const url = new URL(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
      );
      url.searchParams.set("format", "metadata");
      ["From", "To", "Subject", "Date", "Message-ID"].forEach((value) =>
        url.searchParams.append("metadataHeaders", value),
      );
      const response = await providerFetch(
        url.toString(),
        { headers: this.headers() },
        "gmail",
      );
      const data = messageSchema.parse(await response.json());
      const headers = new Map(
        data.payload.headers.map((header) => [
          header.name.toLowerCase(),
          header.value,
        ]),
      );
      output.push({
        id: data.id,
        threadId: data.threadId,
        occurredAt: new Date(Number(data.internalDate)).toISOString(),
        from: headers.get("from") ?? null,
        to: headers.get("to") ?? null,
        subject: headers.get("subject") ?? null,
        externalMessageId: headers.get("message-id") ?? data.id,
        sent: data.labelIds.includes("SENT"),
      });
    }
    return output;
  }
}
export function parseEmailAddresses(value: string | null) {
  if (!value) return [];
  return [...value.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map(
    (match) => match[0].toLowerCase(),
  );
}

export type HoneyBookSmsNotification = {
  clientName: string;
  projectName: string;
};

export function parseHoneyBookSmsNotification(
  from: string | null,
  subject: string | null,
): HoneyBookSmsNotification | null {
  if (
    !parseEmailAddresses(from).some(
      (email) => email === "mailman@honeybook.com",
    )
  )
    return null;
  const match = subject?.trim().match(/^New SMS from (.+?) in (.+)$/i);
  if (!match) return null;
  return { clientName: match[1].trim(), projectName: match[2].trim() };
}

export function normalizedHoneyBookLabel(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export type HoneyBookProjectCandidate = {
  id: string;
  name: string;
  contacts:
    | { first_name: string | null; last_name: string | null }
    | Array<{ first_name: string | null; last_name: string | null }>
    | null;
};

function honeyBookContactName(project: HoneyBookProjectCandidate) {
  const contact = Array.isArray(project.contacts)
    ? project.contacts[0]
    : project.contacts;
  return [contact?.first_name, contact?.last_name].filter(Boolean).join(" ");
}

export function matchHoneyBookSmsProject(
  projects: HoneyBookProjectCandidate[],
  notification: { clientName: string; projectName: string },
) {
  const projectLabel = normalizedHoneyBookLabel(notification.projectName);
  const projectMatches = projects.filter(
    (project) => normalizedHoneyBookLabel(project.name) === projectLabel,
  );
  if (projectMatches.length === 1) return projectMatches[0].id;

  const clientLabel = normalizedHoneyBookLabel(notification.clientName);
  const contactMatches = projects.filter(
    (project) =>
      normalizedHoneyBookLabel(honeyBookContactName(project)) === clientLabel,
  );
  return contactMatches.length === 1 ? contactMatches[0].id : null;
}
