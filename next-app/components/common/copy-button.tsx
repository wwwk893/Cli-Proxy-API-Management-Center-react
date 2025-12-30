"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-context";

type CopyButtonProps = {
  text: string;
  className?: string;
};

export function CopyButton({ text, className }: CopyButtonProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // 复制失败时不抛出，避免影响主流程
      setCopied(false);
    }
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={onCopy}
      className={className}
    >
      {copied ? (
        <>
          <CheckIcon className="size-4" />
          <span>{t("common.copied")}</span>
        </>
      ) : (
        <>
          <CopyIcon className="size-4" />
          <span>{t("copy")}</span>
        </>
      )}
    </Button>
  );
}
