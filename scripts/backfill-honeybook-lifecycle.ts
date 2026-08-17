import { readFile } from "node:fs/promises";

import { createClient } from "@supabase/supabase-js";

import { parseCsv } from "../src/lib/domain/historical-import";
import { dollarsToCents } from "../src/lib/domain/money";

async function main() {
  const filePath = process.argv.find(
    (argument) => !argument.startsWith("--") && argument.endsWith(".csv"),
  );
  const apply = process.argv.includes("--apply");

  if (!filePath) throw new Error("Pass the HoneyBook project-report CSV path");
  if (apply && process.env.CONFIRM_LIFECYCLE_BACKFILL !== "southern-revelry")
    throw new Error(
      "Set CONFIRM_LIFECYCLE_BACKFILL=southern-revelry for an intentional write",
    );

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey)
    throw new Error("Supabase server credentials are required");

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  function label(value: string | null | undefined) {
    return String(value ?? "")
      .normalize("NFKD")
      .replace(/[’']/g, "'")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function emailFrom(value: string) {
    return (
      value
        .match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]
        ?.toLowerCase() ?? null
    );
  }

  function withoutEmail(value: string) {
    return value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "").trim();
  }

  function timestamp(value: string) {
    const parsed = Date.parse(value.trim());
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }

  const csv = await readFile(filePath, "utf8");
  const [headers, ...rows] = parseCsv(csv);
  const headerIndex = new Map(
    headers.map((header, index) => [header.trim().toLowerCase(), index]),
  );
  const value = (row: string[], header: string) =>
    row[headerIndex.get(header.toLowerCase()) ?? -1]?.trim() ?? "";

  const { data: organization, error: organizationError } = await client
    .from("organizations")
    .select("id")
    .eq("slug", "southern-revelry")
    .single();
  if (organizationError || !organization)
    throw new Error("Southern Revelry organization was not found");

  const { data: projects, error: projectError } = await client
    .from("projects")
    .select("id,name,raw_provider_fields,contacts(email_normalized)")
    .eq("organization_id", organization.id)
    .eq("source_origin", "honeybook");
  if (projectError)
    throw new Error("Live HoneyBook projects could not be loaded");

  const sourceRecordIds = (projects ?? [])
    .map((project) => {
      const fields = project.raw_provider_fields as Record<string, unknown>;
      return typeof fields?.latest_source_record_id === "string"
        ? fields.latest_source_record_id
        : null;
    })
    .filter((id): id is string => Boolean(id));
  const { data: sourceRecords, error: sourceRecordError } = sourceRecordIds.length
    ? await client
        .from("source_records")
        .select("id,raw_values")
        .in("id", sourceRecordIds)
    : { data: [], error: null };
  if (sourceRecordError)
    throw new Error("HoneyBook source records could not be loaded");
  const sourceCreationById = new Map(
    (sourceRecords ?? []).map((record) => {
      const values = record.raw_values as Record<string, unknown>;
      return [
        String(record.id),
        timestamp(String(values?.["Project Creation Date"] ?? "")),
      ];
    }),
  );

  const matches = new Map<
    string,
    {
      id: string;
      name: string;
      email: string | null;
      sourceCreatedAt: string | null;
    }
  >();
  for (const project of projects ?? []) {
    const contact = Array.isArray(project.contacts)
      ? project.contacts[0]
      : project.contacts;
    const fields = project.raw_provider_fields as Record<string, unknown>;
    const sourceRecordId =
      typeof fields?.latest_source_record_id === "string"
        ? fields.latest_source_record_id
        : null;
    matches.set(String(project.id), {
      id: String(project.id),
      name: String(project.name),
      email: contact?.email_normalized?.toLowerCase() ?? null,
      sourceCreatedAt: sourceRecordId
        ? (sourceCreationById.get(sourceRecordId) ?? null)
        : null,
    });
  }

  let matched = 0;
  let unmatched = 0;
  let ambiguous = 0;
  let updated = 0;
  for (const row of rows) {
    const projectName = value(row, "Project Name");
    const email = emailFrom(value(row, "Client Info"));
    const sourceCreatedAt = timestamp(value(row, "Project Creation Date"));
    const isSameSourceRecord = (project: {
      sourceCreatedAt: string | null;
    }) =>
      !project.sourceCreatedAt || project.sourceCreatedAt === sourceCreatedAt;
    const candidates = [...matches.values()].filter(
      (project) =>
        label(project.name) === label(projectName) &&
        (!email || !project.email || project.email === email) &&
        isSameSourceRecord(project),
    );
    const fallback = email
      ? [...matches.values()].filter(
          (project) =>
            project.email === email && isSameSourceRecord(project),
        )
      : [];
    const resolved = candidates.length === 1 ? candidates : fallback;
    if (!resolved.length) {
      unmatched += 1;
      continue;
    }
    if (resolved.length !== 1) {
      ambiguous += 1;
      continue;
    }
    matched += 1;
    const projectValue = value(row, "Total Project Value");
    const paidValue = value(row, "Total Paid");
    const patch = {
      inquiry_at: timestamp(value(row, "Project Creation Date")),
      booked_at: timestamp(value(row, "Booked Date")),
      owner_name: withoutEmail(value(row, "Project Owner")) || null,
      booked_value_cents: projectValue ? dollarsToCents(projectValue) : 0,
      collected_cents: paidValue ? dollarsToCents(paidValue) : 0,
    };
    if (!apply) continue;
    const { error } = await client
      .from("projects")
      .update(patch)
      .eq("organization_id", organization.id)
      .eq("id", resolved[0].id);
    if (error) throw new Error(`Lifecycle update failed for ${resolved[0].id}`);
    updated += 1;
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        rows: rows.length,
        matched,
        unmatched,
        ambiguous,
        updated,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Backfill failed");
  process.exitCode = 1;
});
