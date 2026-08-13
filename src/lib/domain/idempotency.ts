export function idempotencyKey(provider: string, externalId: string) {
  const normalized = `${provider.trim().toLowerCase()}:${externalId.trim()}`;
  if (normalized.endsWith(":")) throw new Error("External ID is required");
  return normalized;
}

export function shouldRetry(attempt: number, status?: number) {
  return attempt < 5 && (!status || status === 408 || status === 429 || status >= 500);
}

export function conversionUploadKey(projectId: string, action: string, valueCents: number) {
  return `${projectId}:${action}:${valueCents}`;
}
