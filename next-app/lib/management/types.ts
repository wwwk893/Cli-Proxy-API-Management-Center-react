import "server-only";

export type ManagementErrorCode =
  | "ENV_MISSING"
  | "UNAUTHORIZED"
  | "UPSTREAM_ERROR"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "UNKNOWN";

export type ManagementError = {
  code: ManagementErrorCode;
  message: string;
  retryable?: boolean;
  httpStatus?: number;
  details?: unknown;
};

export type ApiResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: ManagementError };

export function ok<T>(data: T): ApiResult<T> {
  return { data };
}

export function fail(
  code: ManagementErrorCode,
  message: string,
  options: Omit<ManagementError, "code" | "message"> = {},
): ApiResult<never> {
  return {
    error: {
      code,
      message,
      ...options,
    },
  };
}
