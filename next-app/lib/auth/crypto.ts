import "server-only";

import crypto from "node:crypto";

import { AuthError } from "./errors";

export function createSessionToken(): string {
  // 256-bit token, URL-safe.
  return crypto.randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function encryptAdminKey(params: {
  plaintext: string;
  encryptionKey: Buffer;
  aad: string;
}): { ciphertext: Buffer; iv: Buffer; tag: Buffer } {
  const { plaintext, encryptionKey, aad } = params;
  if (encryptionKey.length !== 32) {
    throw new AuthError("MISCONFIGURED", "AUTH_ENCRYPTION_KEY 长度不正确（需要 32 bytes）", 500);
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
  cipher.setAAD(Buffer.from(aad, "utf-8"));

  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(plaintext, "utf-8")),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return { ciphertext, iv, tag };
}

export function decryptAdminKey(params: {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
  encryptionKey: Buffer;
  aad: string;
}): string {
  const { ciphertext, iv, tag, encryptionKey, aad } = params;
  if (encryptionKey.length !== 32) {
    throw new AuthError("MISCONFIGURED", "AUTH_ENCRYPTION_KEY 长度不正确（需要 32 bytes）", 500);
  }

  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey, iv);
    decipher.setAAD(Buffer.from(aad, "utf-8"));
    decipher.setAuthTag(tag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return plaintext.toString("utf-8");
  } catch {
    throw new AuthError("FORBIDDEN", "会话解密失败（可能已失效）", 401);
  }
}
