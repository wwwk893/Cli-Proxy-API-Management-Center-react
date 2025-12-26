import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type StatsCardsProps = {
  successRate: string;
  pendingRunning: number;
  failed: number;
  labels: {
    successRate: string;
    pendingRunning: string;
    failed: string;
  };
};

export function StatsCards({ successRate, pendingRunning, failed, labels }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">{labels.successRate}</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold">{successRate}%</CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">{labels.pendingRunning}</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold">{pendingRunning}</CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">{labels.failed}</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold">{failed}</CardContent>
      </Card>
    </div>
  );
}
