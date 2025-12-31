import "server-only";

export type AuthErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "VALIDATION_ERROR" | "MISCONFIGURED";

export class AuthError extends Error {
  code: AuthErrorCode;
  status: number;
  details?: unknown;

  constructor(code: AuthErrorCode, message: string, status: number, details?: unknown) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function asAuthError(err: unknown): AuthError | null {
  if (err instanceof AuthError) return err;
  return null;
}
