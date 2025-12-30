"use client";

import { useMemo } from "react";
import { AlertCircle, CheckCircle2, Clock, ExternalLink, Loader2, RotateCcw } from "lucide-react";

import type { OAuthFlow, OAuthProvider } from "@/components/oauth/types";
import { DEFAULT_POLLING_POLICY, OAUTH_PROVIDER_CONFIGS } from "@/components/oauth/types";
import { CopyButton } from "@/components/common/copy-button";
import { useI18n } from "@/components/i18n-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AuthFlowPanelProps = {
  provider: OAuthProvider;
  flow: OAuthFlow;
  timeLeftSec: number | null;
  isBusy: boolean;
  onGenerate: () => void;
  onReset: () => void;
  onGoAuthFiles: () => void;
};

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getProviderLabelKey(provider: OAuthProvider) {
  const found = OAUTH_PROVIDER_CONFIGS.find((p) => p.id === provider);
  return found?.labelKey || "oauth.providers.unknown";
}

export function AuthFlowPanel({ provider, flow, timeLeftSec, isBusy, onGenerate, onReset, onGoAuthFiles }: AuthFlowPanelProps) {
  const { t } = useI18n();
  const providerLabelKey = getProviderLabelKey(provider);

  const progress = useMemo(() => {
    if (flow.phase !== "polling" || timeLeftSec === null) return null;
    const total = DEFAULT_POLLING_POLICY.timeoutMs / 1000;
    const ratio = Math.max(0, Math.min(1, (total - timeLeftSec) / total));
    return Math.round(ratio * 100);
  }, [flow.phase, timeLeftSec]);

  const statusBadge = (() => {
    if (flow.phase === "success") {
      return (
        <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-4" />
          {t("oauth.status.ok")}
        </Badge>
      );
    }
    if (flow.phase === "timeout") {
      return (
        <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Clock className="size-4" />
          {t("oauth.status.timeout")}
        </Badge>
      );
    }
    if (flow.phase === "error") {
      return (
        <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertCircle className="size-4" />
          {t("oauth.status.error")}
        </Badge>
      );
    }
    if (flow.phase === "generating") {
      return (
        <Badge variant="outline" className="border-border/60 bg-background/40">
          <Loader2 className="size-4 animate-spin" />
          {t("oauth.status.generating")}
        </Badge>
      );
    }
    if (flow.phase === "polling") {
      return (
        <Badge variant="outline" className="border-border/60 bg-background/40">
          <Clock className="size-4" />
          {t("oauth.status.waiting")}
          {timeLeftSec !== null ? <span className="ml-1 font-mono text-[11px]">{formatCountdown(timeLeftSec)}</span> : null}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="border-border/60 bg-background/40">
        {t("oauth.status.idle")}
      </Badge>
    );
  })();

  const primaryActionLabel = (() => {
    if (flow.phase === "error") return t("oauth.actions.retry");
    if (flow.phase === "timeout") return t("oauth.actions.tryAgain");
    if (flow.phase === "success") return t("oauth.actions.newFlow");
    return t("oauth.actions.generate");
  })();

  const primaryActionDisabled = flow.phase === "polling" || flow.phase === "generating";

  const errorText = (() => {
    if (flow.phase !== "error") return null;
    if (flow.errorKind === "missing_state") return t("oauth.errors.missingState");
    if (flow.errorMessage) return flow.errorMessage;
    return t("oauth.errors.unknown");
  })();

  return (
    <Card className="border-border/60 bg-card/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{t("oauth.flow.title")}</div>
          <div className="mt-1 text-sm text-muted-foreground">
            {t("oauth.flow.subtitle")} <span className="font-medium text-foreground">{t(providerLabelKey)}</span>
          </div>
        </div>
        <div className="shrink-0">{statusBadge}</div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onGenerate} disabled={primaryActionDisabled}>
              {primaryActionLabel}
            </Button>
            <Button variant="outline" onClick={onReset} disabled={isBusy && flow.phase === "generating"}>
              <RotateCcw className="size-4" />
              {t("oauth.actions.reset")}
            </Button>

            {flow.phase === "success" ? (
              <Button variant="secondary" onClick={onGoAuthFiles}>
                {t("oauth.actions.viewAuthFiles")}
              </Button>
            ) : null}
          </div>

          {flow.url ? (
            <div className="rounded-lg border border-border/60 bg-background/40 p-3">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium">{t("oauth.flow.url")}</div>
                  <div className="flex items-center gap-2">
                    <CopyButton text={flow.url} />
                    <Button variant="secondary" size="sm" onClick={() => window.open(flow.url, "_blank", "noopener,noreferrer")}>
                      <ExternalLink className="size-4" />
                      {t("oauth.actions.open")}
                    </Button>
                  </div>
                </div>
                <Input readOnly value={flow.url} className="font-mono text-xs" />
                <div className="flex flex-wrap items-center gap-2">
                  {flow.state ? (
                    <Badge variant="secondary" className="font-mono text-[11px]">
                      {t("oauth.flow.state")}: {flow.state.slice(0, 8)}…
                    </Badge>
                  ) : null}
                  <div className="text-xs text-muted-foreground">{t("oauth.security.urlTip")}</div>
                </div>
              </div>

              {flow.phase === "polling" && progress !== null ? (
                <div className="mt-3">
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div className={cn("h-2 rounded-full bg-primary transition-[width]")} style={{ width: `${progress}%` }} />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{t("oauth.flow.pollingHint")}</div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border/60 bg-background/20 p-4 text-sm text-muted-foreground">
              {t("oauth.flow.empty")}
            </div>
          )}

          {flow.phase === "error" ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 size-4" />
                <div className="min-w-0">
                  <div className="font-medium">{t("oauth.errors.title")}</div>
                  <div className="mt-1 break-words text-xs">{errorText}</div>
                  <div className="mt-2 text-xs text-muted-foreground">{t("oauth.errors.autoResetHint")}</div>
                </div>
              </div>
            </div>
          ) : null}

          {flow.phase === "timeout" ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
              <div className="flex items-start gap-2">
                <Clock className="mt-0.5 size-4 text-amber-600 dark:text-amber-400" />
                <div className="min-w-0">
                  <div className="font-medium">{t("oauth.timeout.title")}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{t("oauth.timeout.desc")}</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
