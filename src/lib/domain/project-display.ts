export function displayProjectName(value: string) {
  return value.replace(/[’']s Project(?:\s*[-–—].*)?$/i, "").trim() || value;
}
