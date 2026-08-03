import { createHash, randomBytes } from "node:crypto";

const PREFIX = "up_health_";

export function generateHealthShortcutToken(): string {
  return `${PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function hashHealthShortcutToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isHealthShortcutToken(token: string): boolean {
  return token.startsWith(PREFIX) && token.length >= 50 && token.length <= 80;
}

export function healthShortcutTokenHint(token: string): string {
  return token.slice(-6);
}
