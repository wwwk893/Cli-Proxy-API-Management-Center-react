"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";

import type { ApiResult } from "@/components/oauth/types";
import { CopyButton } from "@/components/common/copy-button";
import { useI18n } from "@/components/i18n-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type IflowCookieLoginProps = {
  onGoAuthFiles: () => void;
};

type IflowCookiePayload = { cookie: string };
type IflowCookieResult = Record<string, unknown>;

function pickKnownFields(result: IflowCookieResult | null) {
  if (!result) return null;
  const email = typeof result.email === "string" ? result.email : undefined;
  const expired = result.expired;

  const pathCandidate =
    typeof result.saved_path === "string"
      ? result.saved_path
      : typeof result.savedPath === "string"
        ? result.savedPath
        : typeof result.path === "string"
          ? result.path
          : undefined;

  const path = pathCandidate && pathCandidate.trim() ? pathCandidate : undefined;
  const type = typeof result.type === "string" ? result.type : undefined;
  return { email, expired, path, type };
}

export function IflowCookieLogin({ onGoAuthFiles }: IflowCookieLoginProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [cookie, setCookie] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IflowCookieResult | null>(null);

  const known = useMemo(() => pickKnownFields(result), [result]);

  const onSubmit = async () => {
    const value = cookie.trim();
    if (!value) {
      setError(t("oauth.iflow.cookie.required"));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const payload: IflowCookiePayload = { cookie: value };
      const res = await fetch("/api/providers/iflow-cookie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as unknown;
      const parsed = (json || {}) as ApiResult<IflowCookieResult>;

      if (!res.ok || (parsed as any).error) {
        const message = (parsed as any)?.error?.message || res.statusText || t("oauth.errors.requestFailed");
        throw new Error(message);
      }

      setResult((parsed as any).data || null);
      setCookie("");
    } catch (e) {
      const message = e instanceof Error ? e.message : t("oauth.errors.unknown");
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onClear = () => {
    setCookie("");
    setError(null);
    setResult(null);
  };

  const resultText = result ? JSON.stringify(result, null, 2) : "";

  return (
    <Card className="border-border/60 bg-card/60 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{t("oauth.iflow.cookie.title")}</div>
          <div className="mt-1 text-sm text-muted-foreground">{t("oauth.iflow.cookie.subtitle")}</div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          {open ? t("oauth.actions.collapse") : t("oauth.actions.expand")}
        </Button>
      </div>

      {open ? (
        <div className="mt-4 flex flex-col gap-3">
          <div className="rounded-lg border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground">
            {t("oauth.security.cookieTip")}
          </div>

          <div className="grid gap-2">
            <Label>{t("oauth.iflow.cookie.label")}</Label>
            <textarea
              value={cookie}
              onChange={(e) => setCookie(e.target.value)}
              rows={4}
              placeholder={t("oauth.iflow.cookie.placeholder")}
              className={cn(
                "w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs outline-none",
                "font-mono dark:bg-input/30",
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
              )}
              disabled={isSubmitting}
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onSubmit} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("oauth.iflow.cookie.submit")}
            </Button>
            <Button variant="outline" onClick={onClear} disabled={isSubmitting}>
              {t("oauth.actions.clear")}
            </Button>
            {result ? (
              <Button variant="secondary" onClick={onGoAuthFiles} disabled={isSubmitting}>
                {t("oauth.actions.viewAuthFiles")}
              </Button>
            ) : null}
          </div>

          {result ? (
            <div className="rounded-lg border border-border/60 bg-background/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium">{t("oauth.iflow.cookie.resultTitle")}</div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{t("oauth.status.ok")}</Badge>
                  <CopyButton text={resultText} />
                </div>
              </div>

              <div className="mt-3 grid gap-2 text-xs">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-md border border-border/60 bg-background/40 p-2">
                    <div className="text-muted-foreground">{t("oauth.iflow.cookie.result.email")}</div>
                    <div className="mt-0.5 break-words font-mono">{known?.email || "-"}</div>
                  </div>
                  <div className="rounded-md border border-border/60 bg-background/40 p-2">
                    <div className="text-muted-foreground">{t("oauth.iflow.cookie.result.expired")}</div>
                    <div className="mt-0.5 break-words font-mono">{known?.expired === undefined ? "-" : String(known.expired)}</div>
                  </div>
                  <div className="rounded-md border border-border/60 bg-background/40 p-2">
                    <div className="text-muted-foreground">{t("oauth.iflow.cookie.result.path")}</div>
                    <div className="mt-0.5 break-words font-mono">{known?.path || "-"}</div>
                  </div>
                  <div className="rounded-md border border-border/60 bg-background/40 p-2">
                    <div className="text-muted-foreground">{t("oauth.iflow.cookie.result.type")}</div>
                    <div className="mt-0.5 break-words font-mono">{known?.type || "-"}</div>
                  </div>
                </div>

                <div className="mt-1 text-xs text-muted-foreground">{t("oauth.iflow.cookie.result.hint")}</div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
