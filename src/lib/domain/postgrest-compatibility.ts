type PostgrestErrorLike = {
  code?: string;
  message?: string;
};

type SelectResult = {
  error: PostgrestErrorLike | null;
};

const lifecycleProjectColumns = ["inquiry_at", "booked_at", "owner_name"];

export function isMissingLifecycleProjectColumn(
  error: PostgrestErrorLike | null,
) {
  if (error?.code !== "42703") return false;
  const message = error.message ?? "";
  return (
    message.includes("does not exist") &&
    lifecycleProjectColumns.some((column) => message.includes(column))
  );
}

export async function selectWithLifecycleFallback<T extends SelectResult>(
  primarySelect: string,
  legacySelect: string,
  runSelect: (columns: string) => PromiseLike<T>,
) {
  const primary = await runSelect(primarySelect);
  if (!isMissingLifecycleProjectColumn(primary.error)) return primary;
  return runSelect(legacySelect);
}
