import { createHash } from "node:crypto";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  beginSyncRun,
  failSyncRun,
  finishSyncRun,
} from "@/lib/integrations/sync-run";
import {
  GmailMetadataProvider,
  matchHoneyBookSmsProject,
  parseEmailAddresses,
  parseHoneyBookSmsNotification,
  type HoneyBookProjectCandidate,
} from "./gmail";
import { refreshGoogleAccessToken } from "./tokens";

export async function syncGmailMetadata(organizationId: string) {
  const runId = await beginSyncRun(
    organizationId,
    "gmail",
    "metadata_incremental",
  );
  if (!runId) return { overlap: true };
  const admin = createAdminSupabaseClient();
  try {
    const { data: connection } = await admin
      .from("sync_connections")
      .select("id,encrypted_refresh_token,configuration")
      .eq("organization_id", organizationId)
      .eq("provider", "gmail")
      .in("status", ["connected", "degraded"])
      .single();
    if (!connection?.encrypted_refresh_token)
      throw new Error("Gmail connection is incomplete");

    const configuration = (connection.configuration ?? {}) as Record<
      string,
      unknown
    >;
    const provider = new GmailMetadataProvider(
      await refreshGoogleAccessToken(
        String(connection.encrypted_refresh_token),
      ),
    );
    const profile = await provider.profile();
    const after = configuration.lastInternalDateMs
      ? Math.floor(Number(configuration.lastInternalDateMs) / 1000) - 300
      : Math.floor(Date.now() / 1000) - 30 * 86_400;
    const messages = await provider.listMetadata(after);
    const hasHoneyBookNotifications = messages.some((message) =>
      Boolean(parseHoneyBookSmsNotification(message.from, message.subject)),
    );
    const { data: honeyBookProjects } = hasHoneyBookNotifications
      ? await admin
          .from("projects")
          .select("id,name,contacts(first_name,last_name)")
          .eq("organization_id", organizationId)
          .eq("source_origin", "honeybook")
      : { data: [] };
    const honeyBookCandidates = (honeyBookProjects ??
      []) as unknown as HoneyBookProjectCandidate[];
    let matched = 0;
    let unmatched = 0;
    let maxInternalDate = Number(configuration.lastInternalDateMs ?? 0);

    for (const message of messages) {
      maxInternalDate = Math.max(
        maxInternalDate,
        Date.parse(message.occurredAt),
      );
      const notification = parseHoneyBookSmsNotification(
        message.from,
        message.subject,
      );
      const externalAddresses = [
        ...new Set(
          (message.sent
            ? parseEmailAddresses(message.to)
            : parseEmailAddresses(message.from)
          ).filter((email) => email !== profile.emailAddress.toLowerCase()),
        ),
      ];

      let projectId: string | null = null;
      let matchedBy = "unmatched";
      if (notification) {
        projectId = matchHoneyBookSmsProject(honeyBookCandidates, notification);
        if (projectId) matchedBy = "provider_id";
      } else {
        const { data: contacts } = externalAddresses.length
          ? await admin
              .from("contacts")
              .select("id,email_normalized,projects(id)")
              .eq("organization_id", organizationId)
              .in("email_normalized", externalAddresses)
          : { data: [] };
        const projectIds = [
          ...new Set(
            (contacts ?? []).flatMap((contact) =>
              ((contact.projects ?? []) as Array<{ id: string }>).map(
                (project) => project.id,
              ),
            ),
          ),
        ];
        projectId = projectIds.length === 1 ? projectIds[0] : null;
        if (projectId) matchedBy = "email";
      }

      const channel = notification ? "sms" : "email";
      await admin.from("communications").upsert(
        {
          organization_id: organizationId,
          project_id: projectId,
          provider: "gmail",
          external_message_id: message.id,
          thread_id: message.threadId,
          direction: message.sent ? "outbound" : "inbound",
          channel,
          subject: message.subject,
          internal_summary: notification
            ? "HoneyBook SMS notification synchronized; message body not stored."
            : "Email metadata synchronized; message body not stored.",
          occurred_at: message.occurredAt,
          match_confidence: projectId ? "exact" : "unmatched",
          matched_by: matchedBy,
          source_origin: "email",
          metadata: {
            header_message_id_present: Boolean(message.externalMessageId),
            honeybook_notification: notification ? "sms" : null,
          },
        },
        { onConflict: "organization_id,provider,external_message_id" },
      );

      if (projectId) {
        matched += 1;
        await admin
          .from("projects")
          .update({
            last_communication_at: message.occurredAt,
            last_communication_channel: channel,
          })
          .eq("id", projectId)
          .or(
            `last_communication_at.is.null,last_communication_at.lt.${message.occurredAt}`,
          );
        if (message.sent) {
          await admin
            .from("tasks")
            .update({ completed_at: message.occurredAt })
            .eq("organization_id", organizationId)
            .eq("project_id", projectId)
            .eq("provider", "honeybook_automation")
            .lte("created_at", message.occurredAt)
            .is("completed_at", null);
          const { data: next } = await admin
            .from("tasks")
            .select("due_at")
            .eq("organization_id", organizationId)
            .eq("project_id", projectId)
            .is("completed_at", null)
            .not("due_at", "is", null)
            .order("due_at")
            .limit(1)
            .maybeSingle();
          await admin
            .from("projects")
            .update({ next_follow_up_at: next?.due_at ?? null })
            .eq("organization_id", organizationId)
            .eq("id", projectId);
        }
      } else {
        unmatched += 1;
        const fingerprint = createHash("sha256")
          .update(`gmail:${message.id}`)
          .digest("hex");
        const { data: source } = await admin
          .from("source_records")
          .upsert(
            {
              organization_id: organizationId,
              source_type: "gmail",
              provider_record_id: message.id,
              raw_values: {
                message_id: message.id,
                thread_id: message.threadId,
                direction: message.sent ? "outbound" : "inbound",
                subject: message.subject,
                occurred_at: message.occurredAt,
                external_addresses: externalAddresses,
              },
              normalized_values: {},
              import_fingerprint: fingerprint,
            },
            { onConflict: "organization_id,source_type,import_fingerprint" },
          )
          .select("id")
          .single();
        if (source)
          await admin.from("mapping_queue").upsert(
            {
              organization_id: organizationId,
              source_record_id: source.id,
              field_name: "project_match",
              source_value:
                notification?.projectName ||
                externalAddresses.join(", ") ||
                "[no external address]",
              candidate_entity_ids: [],
              status: "pending",
              affected_count: 1,
            },
            { onConflict: "source_record_id,field_name" },
          );
      }
    }

    const now = new Date().toISOString();
    if (unmatched)
      await admin.from("integration_health_issues").upsert(
        {
          organization_id: organizationId,
          connection_id: connection.id,
          provider: "gmail",
          issue_key: "unmatched_communications",
          entity_provider_id: "mailbox",
          severity: "warning",
          title: "Email messages need project mapping",
          detail: `${unmatched} synchronized message${unmatched === 1 ? "" : "s"} could not be matched exactly.`,
          last_detected_at: now,
          resolved_at: null,
        },
        {
          onConflict: "organization_id,provider,issue_key,entity_provider_id",
        },
      );
    else
      await admin
        .from("integration_health_issues")
        .update({ resolved_at: now })
        .eq("organization_id", organizationId)
        .eq("provider", "gmail")
        .eq("issue_key", "unmatched_communications")
        .is("resolved_at", null);

    await admin
      .from("sync_connections")
      .update({
        configuration: {
          ...configuration,
          mailbox: profile.emailAddress,
          lastInternalDateMs: maxInternalDate,
        },
        last_attempt_at: now,
        last_success_at: now,
        status: unmatched ? "degraded" : "connected",
      })
      .eq("id", connection.id);
    await finishSyncRun(
      runId,
      { processed: messages.length, created: matched, skipped: unmatched },
      unmatched ? "partial" : "succeeded",
    );
    return { processed: messages.length, matched, unmatched };
  } catch (error) {
    await failSyncRun(runId, "gmail", error);
    await admin
      .from("sync_connections")
      .update({ status: "failed", last_attempt_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("provider", "gmail");
    throw error;
  }
}
