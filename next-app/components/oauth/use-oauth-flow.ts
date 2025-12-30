"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ApiResult, OAuthFlow, OAuthProvider, OAuthStatusData, OAuthUrlData } from "@/components/oauth/types";
import { DEFAULT_POLLING_POLICY } from "@/components/oauth/types";

type UseOAuthFlowParams = {
  pollIntervalMs?: number;
  timeoutMs?: number;
  errorResetMs?: number;
};

function parseApiResult<T>(res: Response, json: unknown): ApiResult<T> {
  if (!res.ok) {
    return {
      error: {
        code: "HTTP_ERROR",
        message: res.statusText || `HTTP ${res.status}`,
        httpStatus: res.status,
      },
    };
  }
  if (!json || typeof json !== "object") {
    return { error: { code: "INVALID_RESPONSE", message: "Invalid response" } };
  }
  return json as ApiResult<T>;
}

function extractOAuthStatus(data: Record<string, unknown>): OAuthStatusData | null {
  const statusRaw = data?.status;
  const errorRaw = data?.error;
  const status = typeof statusRaw === "string" ? statusRaw : "";
  if (status === "ok" || status === "wait" || status === "error") {
    return {
      status,
      error: typeof errorRaw === "string" && errorRaw.trim() ? errorRaw : undefined,
    };
  }
  return null;
}

const EMPTY_FLOW: OAuthFlow = {
  provider: "codex",
  phase: "idle",
  url: "",
  state: null,
  startedAt: null,
  deadlineAt: null,
  lastStatus: null,
  errorKind: null,
  errorMessage: null,
};

export function useOAuthFlow(params: UseOAuthFlowParams = {}) {
  const pollIntervalMs = params.pollIntervalMs ?? DEFAULT_POLLING_POLICY.intervalMs;
  const timeoutMs = params.timeoutMs ?? DEFAULT_POLLING_POLICY.timeoutMs;
  const errorResetMs = params.errorResetMs ?? DEFAULT_POLLING_POLICY.errorResetMs;

  const pollTimerRef = useRef<number | null>(null);
  const errorResetTimerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const flowRef = useRef<OAuthFlow>(EMPTY_FLOW);

  const [flow, setFlow] = useState<OAuthFlow>(EMPTY_FLOW);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    flowRef.current = flow;
  }, [flow]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const clearErrorResetTimer = useCallback(() => {
    if (errorResetTimerRef.current !== null) {
      window.clearTimeout(errorResetTimerRef.current);
      errorResetTimerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stopPolling();
    clearErrorResetTimer();
    runIdRef.current += 1;
    setFlow((prev) => ({
      ...prev,
      phase: "idle",
      url: "",
      state: null,
      startedAt: null,
      deadlineAt: null,
      lastStatus: null,
      errorKind: null,
      errorMessage: null,
    }));
  }, [clearErrorResetTimer, stopPolling]);

  const setProvider = useCallback(
    (provider: OAuthProvider) => {
      reset();
      setFlow((prev) => ({ ...prev, provider }));
    },
    [reset],
  );

  const scheduleAutoReset = useCallback(() => {
    clearErrorResetTimer();
    errorResetTimerRef.current = window.setTimeout(() => {
      reset();
    }, errorResetMs);
  }, [clearErrorResetTimer, errorResetMs, reset]);

  const startPolling = useCallback(
    async (provider: OAuthProvider, state: string, runId: number) => {
      stopPolling();

      const loop = async () => {
        if (runIdRef.current !== runId) return;

        const current = flowRef.current;
        if (current.provider !== provider || current.phase !== "polling") return;
        if (current.deadlineAt !== null && Date.now() >= current.deadlineAt) {
          setFlow((prev) => ({
            ...prev,
            phase: "timeout",
            lastStatus: null,
          }));
          stopPolling();
          return;
        }

        const controller = new AbortController();
        abortRef.current = controller;

        try {
          const res = await fetch(`/api/providers/oauth-status?state=${encodeURIComponent(state)}`, {
            cache: "no-store",
            signal: controller.signal,
          });
          const json = (await res.json().catch(() => null)) as unknown;
          const parsed = parseApiResult<Record<string, unknown>>(res, json);

          if (runIdRef.current !== runId) return;

          if ("error" in parsed && parsed.error) {
            setFlow((prev) => ({
              ...prev,
              phase: "error",
              lastStatus: null,
              errorKind: "polling_failed",
              errorMessage: parsed.error.message || null,
            }));
            scheduleAutoReset();
            stopPolling();
            return;
          }

          const statusData = parsed.data && typeof parsed.data === "object" ? extractOAuthStatus(parsed.data as any) : null;
          if (!statusData) {
            setFlow((prev) => ({
              ...prev,
              phase: "error",
              lastStatus: null,
              errorKind: "polling_failed",
              errorMessage: null,
            }));
            scheduleAutoReset();
            stopPolling();
            return;
          }

          if (statusData.status === "ok") {
            setFlow((prev) => ({ ...prev, phase: "success", lastStatus: "ok" }));
            stopPolling();
            return;
          }

          if (statusData.status === "error") {
            setFlow((prev) => ({
              ...prev,
              phase: "error",
              lastStatus: "error",
              errorKind: "polling_failed",
              errorMessage: statusData.error || null,
            }));
            scheduleAutoReset();
            stopPolling();
            return;
          }

          setFlow((prev) => ({ ...prev, lastStatus: "wait" }));
        } catch (e) {
          if (runIdRef.current !== runId) return;
          const message = e instanceof Error ? e.message : "Unknown error";
          setFlow((prev) => ({
            ...prev,
            phase: "error",
            lastStatus: null,
            errorKind: "polling_failed",
            errorMessage: message,
          }));
          scheduleAutoReset();
          stopPolling();
          return;
        }

        pollTimerRef.current = window.setTimeout(loop, pollIntervalMs);
      };

      pollTimerRef.current = window.setTimeout(loop, 0);
    },
    [pollIntervalMs, scheduleAutoReset, stopPolling],
  );

  const generateUrl = useCallback(
    async (provider: OAuthProvider) => {
      clearErrorResetTimer();
      stopPolling();

      const runId = runIdRef.current + 1;
      runIdRef.current = runId;

      setFlow((prev) => ({
        ...prev,
        provider,
        phase: "generating",
        url: "",
        state: null,
        startedAt: null,
        deadlineAt: null,
        lastStatus: null,
        errorKind: null,
        errorMessage: null,
      }));

      try {
        const res = await fetch(`/api/providers/oauth-url?provider=${encodeURIComponent(provider)}`, { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as unknown;
        const parsed = parseApiResult<OAuthUrlData>(res, json);

        if (runIdRef.current !== runId) return;

        if ("error" in parsed && parsed.error) {
          setFlow((prev) => ({
            ...prev,
            phase: "error",
            errorKind: "request_failed",
            errorMessage: parsed.error.message || null,
          }));
          scheduleAutoReset();
          return;
        }

        const url = parsed.data?.url || "";
        const state = parsed.data?.state || null;
        if (!url || !state) {
          setFlow((prev) => ({
            ...prev,
            phase: "error",
            url,
            state,
            errorKind: "missing_state",
            errorMessage: null,
          }));
          scheduleAutoReset();
          return;
        }

        const now = Date.now();
        setFlow((prev) => ({
          ...prev,
          phase: "polling",
          url,
          state,
          startedAt: now,
          deadlineAt: now + timeoutMs,
          lastStatus: "wait",
          errorKind: null,
          errorMessage: null,
        }));

        await startPolling(provider, state, runId);
      } catch (e) {
        if (runIdRef.current !== runId) return;
        const message = e instanceof Error ? e.message : "Unknown error";
        setFlow((prev) => ({
          ...prev,
          phase: "error",
          errorKind: "request_failed",
          errorMessage: message,
        }));
        scheduleAutoReset();
      }
    },
    [clearErrorResetTimer, scheduleAutoReset, startPolling, stopPolling, timeoutMs],
  );

  const isBusy = flow.phase === "generating" || flow.phase === "polling";

  const timeLeftSec = useMemo(() => {
    if (flow.phase !== "polling" || flow.deadlineAt === null) return null;
    return Math.max(0, Math.ceil((flow.deadlineAt - nowMs) / 1000));
  }, [flow.deadlineAt, flow.phase, nowMs]);

  useEffect(() => {
    return () => {
      stopPolling();
      clearErrorResetTimer();
    };
  }, [clearErrorResetTimer, stopPolling]);

  useEffect(() => {
    if (flow.phase !== "polling" || flow.deadlineAt === null) return;
    setNowMs(Date.now());

    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [flow.deadlineAt, flow.phase]);

  return {
    flow,
    isBusy,
    timeLeftSec,
    setProvider,
    reset,
    stopPolling,
    generateUrl,
  };
}
