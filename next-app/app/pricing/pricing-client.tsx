"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ModelPicker, type ModelOption } from "@/components/model-picker";

type PricingEntry = {
  id: string;
  modelId: string;
  inputCost: number;
  outputCost: number;
  cachedCost: number;
};

type ModelListItem = { id: string; [key: string]: unknown };

const MODELS_ENDPOINT = process.env.NEXT_PUBLIC_MODELS_ENDPOINT || "http://localhost:3818/v1/models";

export function PricingClient() {
  const [models, setModels] = useState<ModelListItem[]>([]);
  const [pricing, setPricing] = useState<PricingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ modelId: "", inputCost: "", outputCost: "", cachedCost: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);

  const extractModels = (payload: unknown): ModelListItem[] => {
    if (!payload || typeof payload !== "object") return [];

    const fromData = (payload as { data?: unknown }).data;
    if (Array.isArray(fromData)) return fromData as ModelListItem[];

    const fromModels = (payload as { models?: unknown }).models;
    if (Array.isArray(fromModels)) return fromModels as ModelListItem[];

    if (Array.isArray(payload)) return payload as ModelListItem[];
    return [];
  };

  const loadModels = async () => {
    try {
      setModelsLoading(true);
      const res = await fetch(MODELS_ENDPOINT);
      if (!res.ok) throw new Error(`Failed to load models: ${res.status}`);
      const json = await res.json();
      const list = extractModels(json);
      setModels(list as ModelListItem[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load models");
    } finally {
      setModelsLoading(false);
    }
  };

  const loadPricing = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/model-pricing");
      if (!res.ok) throw new Error(`Failed to load pricing: ${res.status}`);
      const json = await res.json();
      setPricing(Array.isArray(json?.data) ? json.data : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pricing");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModels();
    loadPricing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setForm({ modelId: "", inputCost: "", outputCost: "", cachedCost: "" });
    setEditingId(null);
    setMessage(null);
  };

  const openForCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openForEdit = (entry: PricingEntry) => {
    setEditingId(entry.modelId);
    setForm({
      modelId: entry.modelId,
      inputCost: entry.inputCost.toString(),
      outputCost: entry.outputCost.toString(),
      cachedCost: entry.cachedCost.toString(),
    });
    setDialogOpen(true);
  };

  const handleDelete = async (modelId: string) => {
    if (!confirm(`删除 ${modelId} 的价格配置？`)) return;
    try {
      const res = await fetch(`/api/model-pricing?modelId=${encodeURIComponent(modelId)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      await loadPricing();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "删除失败");
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      const modelId = form.modelId.trim();
      if (!modelId) throw new Error("请选择模型");

      const payload = {
        modelId,
        inputCost: Number(form.inputCost || 0),
        outputCost: Number(form.outputCost || 0),
        cachedCost: Number(form.cachedCost || 0),
      };
      if (Object.values(payload).some((v) => typeof v === "number" && v < 0)) {
        throw new Error("价格不能为负数");
      }

      const res = await fetch("/api/model-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || "保存失败");
      }
      await loadPricing();
      setDialogOpen(false);
      resetForm();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const modelOptions = useMemo<ModelOption[]>(() => {
    return models
      .map((m) => {
        if (typeof m === "string") return { id: m, name: m };
        if (m && typeof m === "object" && "id" in m) {
          const typed = m as { id?: unknown; name?: unknown; provider?: unknown };
          const id = typeof typed.id === "string" ? typed.id : String(typed.id ?? "");
          if (!id) return null;
          const name = typeof typed.name === "string" ? typed.name : id;
          const provider = typeof typed.provider === "string" ? typed.provider : undefined;
          return { id, name, provider };
        }
        return null;
      })
      .filter(Boolean) as ModelOption[];
  }, [models]);

  const pricingByModel = useMemo(() => {
    const map: Record<string, PricingEntry> = {};
    pricing.forEach((p) => {
      map[p.modelId] = p;
    });
    return map;
  }, [pricing]);

  // deprecated search select flow removed

  const dialogTitle = editingId ? "编辑模型价格" : "添加模型价格";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">模型价格配置</h1>
          <p className="text-sm text-muted-foreground">按每 1,000,000 tokens 设置价格，输出价同时适用于推理 tokens。</p>
        </div>
        <Button onClick={openForCreate}>添加价格</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>已配置模型</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
          {message && <p className="mb-3 text-sm text-muted-foreground">{message}</p>}
          <div className="overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-64">模型</TableHead>
                  <TableHead className="text-right">输入（$ / 1M）</TableHead>
                  <TableHead className="text-right">缓存（$ / 1M）</TableHead>
                  <TableHead className="text-right">输出+推理（$ / 1M）</TableHead>
                  <TableHead className="w-32 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pricing.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      暂无配置，点击“添加价格”。
                    </TableCell>
                  </TableRow>
                ) : null}
                {pricing.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.modelId}</TableCell>
                    <TableCell className="text-right">${row.inputCost.toFixed(6)}</TableCell>
                    <TableCell className="text-right">${row.cachedCost.toFixed(6)}</TableCell>
                    <TableCell className="text-right">${row.outputCost.toFixed(6)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => openForEdit(row)}>
                        编辑
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(row.modelId)}>
                        删除
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <span />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>模型</Label>
              <ModelPicker
                value={form.modelId}
                onChange={(val) => setForm((f) => ({ ...f, modelId: val }))}
                options={modelOptions}
                configuredIds={Object.keys(pricingByModel)}
                loading={modelsLoading}
                error={error}
                disabled={!!editingId}
              />
              <p className="text-xs text-muted-foreground">从 {MODELS_ENDPOINT} 获取的模型列表。</p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label>输入价（$ / 1M）</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.000001"
                  value={form.inputCost}
                  onChange={(e) => setForm((f) => ({ ...f, inputCost: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>缓存价（$ / 1M）</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.000001"
                  value={form.cachedCost}
                  onChange={(e) => setForm((f) => ({ ...f, cachedCost: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>输出+推理价（$ / 1M）</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.000001"
                  value={form.outputCost}
                  onChange={(e) => setForm((f) => ({ ...f, outputCost: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">应用于输出与推理 tokens。</p>
              </div>
            </div>
            {message && <p className="text-sm text-destructive">{message}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
