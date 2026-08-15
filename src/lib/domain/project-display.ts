export function displayProjectName(value: string) {
  return value.replace(/[’']s Project$/i, "").trim() || value;
}
