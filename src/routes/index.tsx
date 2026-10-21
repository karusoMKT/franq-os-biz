import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({ meta: [
    { title: "FranqOS | Acesso à gestão da franquia" },
    { name: "description", content: "Acesse sua empresa no FranqOS para gerenciar rotinas, equipe e finanças." },
    { property: "og:title", content: "FranqOS | Acesso à gestão da franquia" },
    { property: "og:description", content: "Gestão de rotinas, equipe e finanças da sua franquia." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      navigate({ to: data.session ? "/dashboard" : "/auth", replace: true });
    });
  }, [navigate]);
  return null;
}
