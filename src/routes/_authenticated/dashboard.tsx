import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard | FranqOS" }] }),
  component: () => <Outlet />,
  errorComponent: DashboardError,
});

function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Erro ao carregar o Dashboard</CardTitle>
          <CardDescription>{error?.message ?? "Erro desconhecido."}</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button onClick={reset}>Tentar novamente</Button>
          <Button onClick={() => window.location.reload()} variant="outline">
            Recarregar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
