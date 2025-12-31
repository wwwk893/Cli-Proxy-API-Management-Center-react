import "server-only";

import { cookies } from "next/headers";

import { prisma } from "@/lib/db";
import { readManagementEnv } from "@/lib/management/env";
import {
  getCanonicalHostname,
  getCanonicalSiteUrl,
  getAuthCookieName,
  getAuthDefaultTtlDays,
  getCookieSecureFlag,
  requireEncryptionKeyBytes,
} from "./config";
import { createSessionToken, decryptAdminKey, encryptAdminKey, hashSessionToken } from "./crypto";
import { AuthError } from "./errors";

export type AuthSession = {
  id: string;
  serverBase: string;
  adminKey: string;
  expiresAt: Date;
};

type ManagementSessionRow = {
  id: string;
  tokenHash: string;
  serverBase: string;
  keyCiphertext: Buffer;
  keyIv: Buffer;
  keyTag: Buffer;
  expiresAt: Date;
  revokedAt: Date | null;
};

function getSessionDelegate(): any {
  const delegate = (prisma as any).managementSession;
  if (!delegate) {
    throw new AuthError("MISCONFIGURED", "Prisma client missing ManagementSession; please regenerate Prisma client", 500);
  }
  return delegate;
}

export function buildServerBase(port: number): string {
  const host = getCanonicalHostname();

  // Prefer the management base scheme (http/https), fall back to site scheme.
  let protocol = getCanonicalSiteUrl().protocol;
  try {
    protocol = new URL(readManagementEnv().managementBase).protocol || protocol;
  } catch {
    // ignore and keep fallback
  }

  return `${protocol}//${host}:${port}`;
}

export async function readSessionTokenFromCookies(): Promise<string | null> {
  const name = getAuthCookieName();
  const store = await cookies();
  return store.get(name)?.value ?? null;
}

export function buildSessionCookie(token: string, rememberDays?: number) {
  const days = Number.isFinite(rememberDays) ? Number(rememberDays) : getAuthDefaultTtlDays();
  const maxDays = Math.min(Math.max(days, 1), 365);

  return {
    name: getAuthCookieName(),
    value: token,
    options: {
      httpOnly: true,
      secure: getCookieSecureFlag(),
      sameSite: "strict" as const,
      path: "/",
      maxAge: maxDays * 24 * 60 * 60,
    },
  };
}

export function buildClearSessionCookie() {
  return {
    name: getAuthCookieName(),
    value: "",
    options: {
      httpOnly: true,
      secure: getCookieSecureFlag(),
      sameSite: "strict" as const,
      path: "/",
      maxAge: 0,
    },
  };
}

export async function createSession(params: { serverBase: string; adminKey: string; rememberDays?: number }): Promise<{ token: string; expiresAt: Date }> {
  const { serverBase, adminKey } = params;
  const days = Number.isFinite(params.rememberDays) ? Number(params.rememberDays) : getAuthDefaultTtlDays();
  const maxDays = Math.min(Math.max(days, 1), 365);

  const encryptionKey = requireEncryptionKeyBytes();
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);

  const { ciphertext, iv, tag } = encryptAdminKey({
    plaintext: adminKey,
    encryptionKey,
    aad: serverBase,
  });

  const expiresAt = new Date(Date.now() + maxDays * 24 * 60 * 60 * 1000);

  const sessionDelegate = getSessionDelegate();
  await sessionDelegate.create({
    data: {
      tokenHash,
      serverBase,
      keyCiphertext: ciphertext,
      keyIv: iv,
      keyTag: tag,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function revokeSessionByToken(token: string): Promise<boolean> {
  const tokenHash = hashSessionToken(token);
  const sessionDelegate = getSessionDelegate();
  const res = await sessionDelegate.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return Boolean(res?.count);
}

export async function getSessionInfoByToken(token: string): Promise<{ serverBase: string; expiresAt: Date } | null> {
  const tokenHash = hashSessionToken(token);
  const sessionDelegate = getSessionDelegate();

  const row = (await sessionDelegate.findUnique({
    where: { tokenHash },
  })) as ManagementSessionRow | null;

  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) return null;

  return {
    serverBase: row.serverBase,
    expiresAt: new Date(row.expiresAt),
  };
}

export async function getSessionByToken(token: string): Promise<AuthSession | null> {
  const tokenHash = hashSessionToken(token);
  const sessionDelegate = getSessionDelegate();

  const row = (await sessionDelegate.findUnique({
    where: { tokenHash },
  })) as ManagementSessionRow | null;

  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) return null;

  const encryptionKey = requireEncryptionKeyBytes();
  const adminKey = decryptAdminKey({
    ciphertext: row.keyCiphertext,
    iv: row.keyIv,
    tag: row.keyTag,
    encryptionKey,
    aad: row.serverBase,
  });

  return {
    id: row.id,
    serverBase: row.serverBase,
    adminKey,
    expiresAt: new Date(row.expiresAt),
  };
}

export async function requireSession(): Promise<AuthSession> {
  const token = await readSessionTokenFromCookies();
  if (!token) {
    throw new AuthError("UNAUTHORIZED", "未登录", 401);
  }

  const session = await getSessionByToken(token);
  if (!session) {
    throw new AuthError("UNAUTHORIZED", "会话无效或已过期", 401);
  }

  return session;
}
