import { NextResponse } from "next/server";
import { ZodError, ZodType, z } from "zod";

export type ApiError = {
  error: string;
  details?: Record<string, string[]>;
};

export function createErrorResponse(
  message: string,
  status: number,
  details?: Record<string, string[]>
): NextResponse<ApiError> {
  return NextResponse.json({ error: message, details }, { status });
}

export function parseSearchParams<T extends ZodType>(
  searchParams: URLSearchParams,
  schema: T
): { success: true; data: z.infer<T> } | { success: false; error: NextResponse<ApiError> } {
  const params: Record<string, string | string[]> = {};

  searchParams.forEach((value, key) => {
    const existing = params[key];
    if (existing) {
      params[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
    } else {
      params[key] = value;
    }
  });

  try {
    const data = schema.parse(params);
    return { success: true, data };
  } catch (err) {
    if (err instanceof ZodError) {
      const details: Record<string, string[]> = {};
      err.errors.forEach((e) => {
        const path = e.path.join(".");
        if (!details[path]) details[path] = [];
        details[path].push(e.message);
      });
      return {
        success: false,
        error: createErrorResponse("Validation failed", 400, details),
      };
    }
    return {
      success: false,
      error: createErrorResponse("Invalid request parameters", 400),
    };
  }
}

export async function parseJsonBody<T extends ZodType>(
  request: Request,
  schema: T
): Promise<{ success: true; data: z.infer<T> } | { success: false; error: NextResponse<ApiError> }> {
  try {
    const body = await request.json();
    const data = schema.parse(body);
    return { success: true, data };
  } catch (err) {
    if (err instanceof ZodError) {
      const details: Record<string, string[]> = {};
      err.errors.forEach((e) => {
        const path = e.path.join(".");
        if (!details[path]) details[path] = [];
        details[path].push(e.message);
      });
      return {
        success: false,
        error: createErrorResponse("Validation failed", 400, details),
      };
    }
    if (err instanceof SyntaxError) {
      return {
        success: false,
        error: createErrorResponse("Invalid JSON body", 400),
      };
    }
    return {
      success: false,
      error: createErrorResponse("Invalid request body", 400),
    };
  }
}
