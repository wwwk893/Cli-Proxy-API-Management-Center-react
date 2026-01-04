import "server-only";

import type {
  DashboardActionItem,
  DashboardActionKind,
  DashboardActionSeverity,
  DashboardConfigHealth,
  DashboardKpis,
  DashboardPartialError,
  DashboardPipelineHealth,
  DashboardSystemHealth,
  DashboardTopModelRow,
} from "./types";

export type DashboardActionCenterInput = {
  system: DashboardSystemHealth;
  pipeline: DashboardPipelineHealth | null;
  configHealth: DashboardConfigHealth | null;
  topModels: DashboardTopModelRow[] | null;
  kpis: DashboardKpis | null;
  partialErrors: DashboardPartialError[];
};

type Candidate = DashboardActionItem & { priority: number };

const severityOrder: Record<DashboardActionSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function addUnique(items: Candidate[], item: Candidate) {
  if (items.some((x) => x.kind === item.kind)) return;
  items.push(item);
}

function toSeverity(kind: DashboardActionKind): DashboardActionSeverity {
  switch (kind) {
    case "system_disconnected":
      return "critical";
    case "pipeline_failed":
    case "missing_api_keys":
    case "missing_providers":
      return "high";
    case "pipeline_backlog":
    case "missing_pricing":
    case "usage_stats_disabled":
      return "medium";
    default:
      return "low";
  }
}

function makeNav(kind: DashboardActionKind, href: string, title: string, priority: number): Candidate {
  return {
    kind,
    severity: "low",
    title,
    href,
    primaryActionLabel: "打开",
    priority,
  };
}

export function buildActionCenter(input: DashboardActionCenterInput): DashboardActionItem[] {
  const { system, pipeline, configHealth, topModels, kpis } = input;

  const candidates: Candidate[] = [];

  // 规则表（按 P1 审阅要求固化）：
  // 1) system disconnected -> /system（critical）
  // 2) pipeline failed -> /pipeline（high）
  // 3) missing api keys / providers -> /settings（high）
  // 4) missing pricing / usage stats disabled / backlog ->（medium）
  // 5) cost concentrated -> /usage（low/medium）
  // 6) 不足则用导航项补齐到 3 条（low）

  if (!system.connected) {
    addUnique(candidates, {
      kind: "system_disconnected",
      severity: toSeverity("system_disconnected"),
      title: "管理服务未连接",
      description: "无法读取系统与配置状态，建议检查管理地址与密钥配置。",
      href: "/system",
      primaryActionLabel: "查看系统状态",
      priority: 10,
    });
  }

  if (pipeline && pipeline.failed > 0) {
    addUnique(candidates, {
      kind: "pipeline_failed",
      severity: toSeverity("pipeline_failed"),
      title: "聚合任务失败",
      description: `存在 ${pipeline.failed} 个失败任务，可能影响用量与成本统计。`,
      href: "/pipeline",
      primaryActionLabel: "查看管线任务",
      priority: 20,
    });
  }

  if (pipeline && pipeline.pending >= 10) {
    addUnique(candidates, {
      kind: "pipeline_backlog",
      severity: toSeverity("pipeline_backlog"),
      title: "聚合任务积压",
      description: `当前有 ${pipeline.pending} 个待处理任务，统计可能延迟更新。`,
      href: "/pipeline",
      primaryActionLabel: "查看管线任务",
      priority: 30,
    });
  }

  if (configHealth) {
    if (configHealth.apiKeysCount === 0) {
      addUnique(candidates, {
        kind: "missing_api_keys",
        severity: toSeverity("missing_api_keys"),
        title: "未配置 API Keys",
        description: "请先配置上游 API Keys，否则无法正常请求模型。",
        href: "/settings",
        primaryActionLabel: "去配置",
        priority: 40,
      });
    }

    const totalKeys = configHealth.providersSummary.totalUpstreamKeysCount;
    if (totalKeys === 0) {
      addUnique(candidates, {
        kind: "missing_providers",
        severity: toSeverity("missing_providers"),
        title: "未配置 Provider Keys",
        description: "请添加 Gemini/Codex/Claude 或 OpenAI-Compat 的 key。",
        href: "/settings",
        primaryActionLabel: "去配置",
        priority: 50,
      });
    }

    const missingPricing = configHealth.pricingCoverage.missingModelsCount;
    if (typeof missingPricing === "number" && missingPricing > 0) {
      addUnique(candidates, {
        kind: "missing_pricing",
        severity: toSeverity("missing_pricing"),
        title: "模型价格未覆盖",
        description: `有 ${missingPricing} 个使用过的模型未配置价格。`,
        href: "/pricing",
        primaryActionLabel: "去配置价格",
        priority: 60,
      });
    }

    if (configHealth.settingsSummary.usageStatisticsEnabled === false) {
      addUnique(candidates, {
        kind: "usage_stats_disabled",
        severity: toSeverity("usage_stats_disabled"),
        title: "用量统计未开启",
        description: "开启后才能记录与聚合用量数据。",
        href: "/settings",
        primaryActionLabel: "去开启",
        priority: 70,
      });
    }
  }

  if (kpis && topModels && topModels.length > 0) {
    const totalCostUsd = kpis.costUsd;
    const top = topModels[0];
    if (totalCostUsd >= 1 && top.shareCost >= 0.8) {
      addUnique(candidates, {
        kind: "cost_concentrated",
        severity: "medium",
        title: "成本高度集中",
        description: `模型 ${top.model} 占比 ${Math.round(top.shareCost * 100)}%。`,
        href: "/usage",
        primaryActionLabel: "查看用量详情",
        priority: 80,
      });
    }
  }

  // 兜底：补齐 3 条导航项。
  addUnique(candidates, makeNav("view_usage", "/usage", "查看用量", 900));
  addUnique(candidates, makeNav("view_pipeline", "/pipeline", "查看管线", 910));
  addUnique(candidates, makeNav("view_logs", "/logs", "查看日志", 920));
  addUnique(candidates, makeNav("view_system", "/system", "查看系统", 930));
  addUnique(candidates, makeNav("view_settings", "/settings", "查看设置", 940));
  addUnique(candidates, makeNav("view_pricing", "/pricing", "查看价格", 950));

  const sorted = candidates.sort((a, b) => {
    const sev = severityOrder[a.severity] - severityOrder[b.severity];
    if (sev !== 0) return sev;
    return a.priority - b.priority;
  });

  return sorted.slice(0, 5);
}
