"use client";

import { useState } from "react";
import type { ModelOption } from "@/components/usage/filter-popover";
import { UsageFiltersProvider } from "@/lib/usage/usage-filters-context";
import { UsagePageHeader } from "./components/page-header";
import { UsageFiltersBar } from "./components/usage-filters-bar";
import { UsageContent } from "./components/usage-content";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/components/i18n-context";
import { SessionsContent } from "./components/sessions-content";

type Props = {
  initialModels?: ModelOption[];
};

export function UsageClient({ initialModels }: Props) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<"overview" | "sessions">("overview");

  return (
    <UsageFiltersProvider>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1 min-w-0 md:max-w-xl">
            <UsagePageHeader />
          </div>
          <div className="w-full shrink-0 md:w-auto">
            <UsageFiltersBar />
          </div>
        </div>
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as "overview" | "sessions")}>
          <TabsList className="w-fit">
            <TabsTrigger value="overview">{t("overviewTab")}</TabsTrigger>
            <TabsTrigger value="sessions">{t("sessionsTab")}</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <UsageContent initialModels={initialModels} />
          </TabsContent>
          <TabsContent value="sessions">
            <SessionsContent onChangeTab={setActiveTab} />
          </TabsContent>
        </Tabs>
      </div>
    </UsageFiltersProvider>
  );
}
