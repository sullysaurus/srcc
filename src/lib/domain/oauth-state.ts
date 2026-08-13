import { createHmac, timingSafeEqual } from "node:crypto";

export function signOAuthState(payload: string, secret: string) {
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

export function validateOAuthState(state: string, secret: string) {
  const separator = state.lastIndexOf(".");
  if (separator < 1) return false;
  const payload = state.slice(0, separator);
  const actual = Buffer.from(state.slice(separator + 1));
  const expected = Buffer.from(createHmac("sha256", secret).update(payload).digest("base64url"));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
