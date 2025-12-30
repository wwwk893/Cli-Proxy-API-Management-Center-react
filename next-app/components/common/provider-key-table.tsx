"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type ProviderKeyTableRow = {
  index: number;
  maskedKey: string;
  baseUrl?: string;
  proxyUrl?: string;
  name?: string;
  hasHeaders?: boolean;
};

export function ProviderKeyTable(props: {
  title: string;
  subtitle?: string;
  rows: ProviderKeyTableRow[];
  onAdd: () => void;
  onEdit: (row: ProviderKeyTableRow) => void;
  onDelete: (row: ProviderKeyTableRow) => void;
  busy: boolean;
  t: (key: string) => string;
  showName?: boolean;
}) {
  const { title, subtitle, rows, onAdd, onEdit, onDelete, busy, t, showName } = props;
  const hasRows = rows.length > 0;

  return (
    <Card className="border-border/60 bg-card/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          {subtitle ? <div className="text-sm text-muted-foreground">{subtitle}</div> : null}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {t("providers.count")}: {rows.length}
          </Badge>
          <Button onClick={onAdd} disabled={busy}>
            {t("providers.actions.add")}
          </Button>
        </div>
      </div>

      {!hasRows ? (
        <div className="mt-6 text-sm text-muted-foreground">{t("providers.empty")}</div>
      ) : (
        <div className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("providers.table.index")}</TableHead>
                {showName ? <TableHead>{t("providers.table.name")}</TableHead> : null}
                <TableHead>{t("providers.table.key")}</TableHead>
                <TableHead>{t("providers.table.baseUrl")}</TableHead>
                <TableHead>{t("providers.table.proxyUrl")}</TableHead>
                <TableHead>{t("providers.table.headers")}</TableHead>
                <TableHead>{t("providers.table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.index}>
                  <TableCell className="text-muted-foreground">#{row.index + 1}</TableCell>
                  {showName ? <TableCell className="text-sm">{row.name || "-"}</TableCell> : null}
                  <TableCell className="font-mono text-xs">{row.maskedKey}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.baseUrl || "-"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.proxyUrl || "-"}</TableCell>
                  <TableCell>
                    {row.hasHeaders ? <Badge variant="outline">{t("providers.headers.present")}</Badge> : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="secondary" onClick={() => onEdit(row)} disabled={busy}>
                        {t("providers.actions.edit")}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => onDelete(row)} disabled={busy}>
                        {t("delete")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

