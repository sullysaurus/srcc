import { readFile } from "node:fs/promises";

import { createClient } from "@supabase/supabase-js";

type HoneyBookActivity = {
  honeybookProjectId: string;
  lastContactAt: string | null;
  proposalViewedDates: string[];
  error?: string;
};

async function main() {
  const inputPath = process.argv[2];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!inputPath) throw new Error("Provide the HoneyBook activity JSON path");
  if (!supabaseUrl || !serviceRoleKey)
    throw new Error("Supabase service credentials are not configured");

  const entries = JSON.parse(
    await readFile(inputPath, "utf8"),
  ) as HoneyBookActivity[];
  const standardFetch = globalThis.fetch;
  const retryingFetch: typeof fetch = async (input, init) => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const response = await standardFetch(input, init);
        if (response.status < 500 || attempt === 4) return response;
      } catch (error) {
        lastError = error;
        if (attempt === 4) throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
    }
    throw lastError;
  };
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: retryingFetch },
  });

  const { data: organizations, error: organizationError } = await supabase
    .from("organizations")
    .select("id")
    .limit(2);
  if (organizationError || organizations?.length !== 1)
    throw new Error(
      "Expected exactly one organization for this one-time backfill",
    );
  const organizationId = organizations[0].id;

  let matchedProjects = 0;
  let lastContactsUpdated = 0;
  let proposalsUpdated = 0;
  let viewsStored = 0;
  let activitiesStored = 0;
  let missingProjects = 0;

  const asDayTimestamp = (date: string) => `${date}T12:00:00.000Z`;

  for (const entry of entries) {
    if (entry.error) continue;
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id,last_communication_at")
      .eq("organization_id", organizationId)
      .eq("honeybook_project_id", entry.honeybookProjectId)
      .maybeSingle();
    if (projectError) throw projectError;
    if (!project) {
      missingProjects += 1;
      continue;
    }
    matchedProjects += 1;

    if (entry.lastContactAt) {
      const occurredAt = asDayTimestamp(entry.lastContactAt);
      if (
        !project.last_communication_at ||
        Date.parse(project.last_communication_at) < Date.parse(occurredAt)
      ) {
        const { error } = await supabase
          .from("projects")
          .update({
            last_communication_at: occurredAt,
            last_communication_channel: "HoneyBook activity",
          })
          .eq("organization_id", organizationId)
          .eq("id", project.id);
        if (error) throw error;
        lastContactsUpdated += 1;
      }
    }

    const viewedDates = [...new Set(entry.proposalViewedDates)].sort();
    if (!viewedDates.length) continue;

    const providerId = `project:${entry.honeybookProjectId}`;
    const { data: proposal, error: proposalError } = await supabase
      .from("proposals")
      .upsert(
        {
          organization_id: organizationId,
          project_id: project.id,
          provider: "honeybook_activity_backfill",
          provider_id: providerId,
          status: "Viewed",
          raw_provider_fields: {
            source: "honeybook_activity_backfill",
            precision: "day",
          },
        },
        { onConflict: "organization_id,provider,provider_id" },
      )
      .select("id")
      .single();
    if (proposalError) throw proposalError;
    proposalsUpdated += 1;

    for (const viewedDate of viewedDates) {
      const providerEventId = `honeybook-activity:${entry.honeybookProjectId}:proposal-viewed:${viewedDate}`;
      const viewedAt = asDayTimestamp(viewedDate);
      const { error: viewError } = await supabase.from("proposal_views").upsert(
        {
          organization_id: organizationId,
          proposal_id: proposal.id,
          provider_event_id: providerEventId,
          viewed_at: viewedAt,
          source_origin: "honeybook",
        },
        { onConflict: "organization_id,provider_event_id" },
      );
      if (viewError) throw viewError;
      viewsStored += 1;

      const { error: activityError } = await supabase
        .from("activity_events")
        .upsert(
          {
            organization_id: organizationId,
            project_id: project.id,
            event_type: "proposal_viewed",
            title: "Proposal viewed",
            detail: "Confirmed in HoneyBook project activity",
            source_origin: "honeybook",
            provider_event_id: providerEventId,
            occurred_at: viewedAt,
            metadata: {
              source: "honeybook_activity_backfill",
              precision: "day",
            },
          },
          { onConflict: "organization_id,source_origin,provider_event_id" },
        );
      if (activityError) throw activityError;
      activitiesStored += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        inputRecords: entries.length,
        matchedProjects,
        missingProjects,
        lastContactsUpdated,
        proposalsUpdated,
        viewsStored,
        activitiesStored,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
