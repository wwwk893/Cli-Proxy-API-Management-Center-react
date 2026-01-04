import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function QuickLinksCard({
  t,
  usageHref,
}: {
  t: (key: string) => string;
  usageHref: string;
}) {
  const links = [
    { href: usageHref, label: t("dashboard.links.usage") },
    { href: "/pipeline", label: t("dashboard.links.pipeline") },
    { href: "/logs", label: t("dashboard.links.logs") },
    { href: "/system", label: t("dashboard.links.system") },
  ];

  return (
    <Card className="bg-muted/10">
      <CardHeader>
        <CardTitle>{t("dashboard.quickLinks.title")}</CardTitle>
        <CardDescription>{t("dashboard.quickLinks.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-1">
        {links.map((l) => (
          <Button key={l.href} asChild variant="ghost" size="sm" className="group h-9 justify-between px-2">
            <Link href={l.href}>
              {l.label}
              <ExternalLink className="h-4 w-4 text-muted-foreground transition group-hover:text-foreground" />
            </Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
