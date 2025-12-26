"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PreviewCardProps = {
  modelCount: number;
  channelCount: number;
  dayCount: number;
  fromDate: string;
  toDate: string;
  t: (key: string) => string;
};

export function PreviewCard({ modelCount, channelCount, dayCount, fromDate, toDate, t }: PreviewCardProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{t("aggregationPreviewTitle")}</CardTitle>
        <CardDescription>{t("aggregationPreviewHint")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <div>
          {t("aggregationPreviewCombos")}：{modelCount} × {channelCount}
        </div>
        <div>
          {t("aggregationPreviewDays")}：{dayCount}
        </div>
        <div>
          {t("aggregationPreviewRange")}：{fromDate || "-"} → {toDate || "-"}
        </div>
      </CardContent>
    </Card>
  );
}
