"use client";

import { useMemo } from "react";
import { Code2, Feather, FlaskConical, Gem, Sparkles, Workflow } from "lucide-react";

import type { OAuthProvider } from "@/components/oauth/types";
import { OAUTH_PROVIDER_CONFIGS } from "@/components/oauth/types";
import { useI18n } from "@/components/i18n-context";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ProviderGridProps = {
  value: OAuthProvider;
  onChange: (provider: OAuthProvider) => void;
  disabled?: boolean;
};

function getProviderIcon(id: OAuthProvider) {
  switch (id) {
    case "codex":
      return Code2;
    case "anthropic":
      return Feather;
    case "antigravity":
      return FlaskConical;
    case "gemini-cli":
      return Gem;
    case "qwen":
      return Sparkles;
    case "iflow":
      return Workflow;
  }
}

export function ProviderGrid({ value, onChange, disabled }: ProviderGridProps) {
  const { t } = useI18n();
  const providers = useMemo(() => OAUTH_PROVIDER_CONFIGS, []);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
      {providers.map((p) => {
        const active = p.id === value;
        const Icon = getProviderIcon(p.id);

        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            disabled={disabled}
            className={cn(
              "rounded-xl border border-border/60 bg-card/60 p-3 text-left backdrop-blur transition-colors",
              "disabled:cursor-not-allowed disabled:opacity-60",
              active ? "border-primary/60 bg-primary/10 hover:border-primary/60 hover:bg-primary/10" : "hover:border-border hover:bg-card/80",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <div className={cn("rounded-md border border-border/60 bg-background/40 p-1.5", active ? "border-primary/40" : "")}>
                  <Icon className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{t(p.labelKey)}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {p.supportsUrl ? (
                      <Badge variant="outline" className="bg-background/40 text-[10px]">
                        {t("oauth.tags.url")}
                      </Badge>
                    ) : null}
                    {p.supportsCookie ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {t("oauth.tags.cookie")}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>

              {active ? (
                <Badge variant="secondary" className="shrink-0">
                  {t("oauth.selected")}
                </Badge>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
