"use client";

import { useEffect, useMemo, useState } from "react";

import { Eye, EyeOff, Loader2 } from "lucide-react";

import { useI18n } from "@/components/i18n-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ApiResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: { code: string; message: string; details?: unknown } };

type ProbeData = {
  connected: boolean;
  serverBase: string;
  managementUrl: string;
  serverVersion: string | null;
  serverBuildDate: string | null;
};

type LoginData = {
  authenticated: true;
  serverBase: string;
  expiresAt: string;
};

type SessionData =
  | { authenticated: false }
  | { authenticated: true; serverBase: string; expiresAt: string };

function safeNext(next: string | null): string | null {
  if (!next) return null;
  const trimmed = next.trim();
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.startsWith("//")) return null;
  return trimmed;
}

function formatBuildDate(value: string | null, locale: "en" | "zh") {
  if (!value) return "-";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toLocaleString(locale === "zh" ? "zh-CN" : "en-US");
}

export default function LoginPage() {
  const { t, locale, setLocale } = useI18n();

  const uiText = useMemo(
    () => ({
      title: t("login.title"),
      subtitle: t("login.subtitle"),
      hostLabel: t("login.hostLabel"),
      portLabel: t("login.portLabel"),
      keyLabel: t("login.adminKeyLabel"),
      adminKeyPlaceholder: t("login.adminKeyPlaceholder"),
      rememberHint: t("login.rememberHint"),
      test: t("login.testConnection"),
      signIn: t("login.signIn"),
      signingIn: t("login.signingIn"),
      testing: t("login.testing"),
      connected: t("login.connected"),
      notConnected: t("login.notConnected"),
      invalidPort: t("login.invalidPort"),
      keyRequired: t("login.keyRequired"),
      alreadySignedIn: t("login.alreadySignedIn"),
    }),
    [t],
  );

  const canonicalHost = useMemo(() => {
    const raw = process.env.NEXT_PUBLIC_SITE_URL;
    if (raw) {
      try {
        return new URL(raw).hostname;
      } catch {
        // ignore
      }
    }
    if (typeof window === "undefined") return "";
    return window.location.hostname;
  }, []);

  const [port, setPort] = useState(() => {
    if (typeof window === "undefined") return "3818";
    return localStorage.getItem("auth-port") || "3818";
  });
  const [adminKey, setAdminKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const [probeLoading, setProbeLoading] = useState(false);
  const [probeResult, setProbeResult] = useState<ProbeData | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);

  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("auth-port", port);
  }, [port]);

  useEffect(() => {
    // If already authenticated, redirect away from /login.
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const json = (await res.json()) as ApiResult<SessionData>;
        if (cancelled) return;
        if (!res.ok || json.error) return;
        if (json.data.authenticated) {
          setInfo(uiText.alreadySignedIn);
          const sp = new URLSearchParams(window.location.search);
          const next = safeNext(sp.get("next")) || "/";
          window.location.href = next;
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uiText.alreadySignedIn]);

  const parsedPort = useMemo(() => {
    const num = Number(port);
    if (!Number.isInteger(num) || num < 1 || num > 65535) return null;
    return num;
  }, [port]);

  const statusBadge = useMemo(() => {
    if (probeLoading) return <Badge variant="secondary">{uiText.testing}</Badge>;
    if (probeResult?.connected) return <Badge variant="default">{uiText.connected}</Badge>;
    if (probeError) return <Badge variant="destructive">{uiText.notConnected}</Badge>;
    return <Badge variant="secondary">{uiText.notConnected}</Badge>;
  }, [probeError, probeLoading, probeResult?.connected, uiText.connected, uiText.notConnected, uiText.testing]);

  const onProbe = async () => {
    setProbeError(null);
    setProbeResult(null);
    setLoginError(null);
    setInfo(null);

    if (!parsedPort) {
      setProbeError(uiText.invalidPort);
      return;
    }
    if (!adminKey.trim()) {
      setProbeError(uiText.keyRequired);
      return;
    }

    setProbeLoading(true);
    try {
      const res = await fetch("/api/auth/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ port: parsedPort, adminKey: adminKey.trim() }),
      });
      const json = (await res.json()) as ApiResult<ProbeData>;
      if (!res.ok || json.error) {
        setProbeError(json.error?.message || res.statusText || "Probe failed");
        return;
      }
      setProbeResult(json.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setProbeError(message);
    } finally {
      setProbeLoading(false);
    }
  };

  const onLogin = async () => {
    setLoginError(null);
    setInfo(null);

    if (!parsedPort) {
      setLoginError(uiText.invalidPort);
      return;
    }
    if (!adminKey.trim()) {
      setLoginError(uiText.keyRequired);
      return;
    }

    setLoginLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ port: parsedPort, adminKey: adminKey.trim(), rememberDays: 30 }),
      });
      const json = (await res.json()) as ApiResult<LoginData>;
      if (!res.ok || json.error) {
        setLoginError(json.error?.message || res.statusText || "Login failed");
        return;
      }

      const sp = new URLSearchParams(window.location.search);
      const next = safeNext(sp.get("next")) || "/";
      window.location.href = next;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setLoginError(message);
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-[520px] bg-glass border-white/10 shadow-2xl shadow-black/30">
      <CardHeader className="border-b border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-xl tracking-tight">{uiText.title}</CardTitle>
            <CardDescription className="mt-1">{uiText.subtitle}</CardDescription>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2">
                {locale === "zh" ? "中文" : "English"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setLocale("en")}>English</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setLocale("zh")}>中文</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">{uiText.rememberHint}</div>
          {statusBadge}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>{uiText.hostLabel}</Label>
          <Input value={canonicalHost} readOnly className="bg-background/20" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{uiText.portLabel}</Label>
            <Input
              inputMode="numeric"
              autoComplete="off"
              value={port}
              onChange={(e) => setPort(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="3818"
              aria-invalid={!parsedPort}
            />
          </div>

          <div className="space-y-2">
            <Label>{uiText.keyLabel}</Label>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder={uiText.adminKeyPlaceholder}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-1 top-1/2 -translate-y-1/2"
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? "Hide" : "Show"}
              >
                {showKey ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </div>
        </div>

        {probeResult ? (
          <div className="rounded-lg border border-white/10 bg-background/20 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">{uiText.connected}</div>
              <div className="text-xs text-muted-foreground break-all">{probeResult.serverBase}</div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Version: {probeResult.serverVersion || "-"} · Build: {formatBuildDate(probeResult.serverBuildDate, locale)}
            </div>
          </div>
        ) : null}

        {probeError ? <div className="text-sm text-destructive">{probeError}</div> : null}
        {loginError ? <div className="text-sm text-destructive">{loginError}</div> : null}
        {info ? <div className="text-sm text-muted-foreground">{info}</div> : null}

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onProbe}
            disabled={probeLoading || loginLoading}
          >
            {probeLoading ? <Loader2 className="animate-spin" /> : null}
            {uiText.test}
          </Button>

          <Button type="button" onClick={onLogin} disabled={probeLoading || loginLoading} className="flex-1">
            {loginLoading ? <Loader2 className="animate-spin" /> : null}
            {loginLoading ? uiText.signingIn : uiText.signIn}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
