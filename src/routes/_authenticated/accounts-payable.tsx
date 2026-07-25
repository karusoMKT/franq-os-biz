import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Loader2, Save, FileText, Calendar, Building2, DollarSign, RefreshCcw } from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loading } from "@/components/loading";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { ocrBill, type OcrBillResult } from "@/lib/api/ocr-bill.functions";

export const Route = createFileRoute("/_authenticated/accounts-payable")({
  head: () => ({
    meta: [
      { title: "Contas a Pagar - FranqOS" },
      { name: "description", content: "Escaneie boletos e contas de consumo com IA e registre em segundos." },
    ],
  }),
  component: AccountsPayablePage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-red-600">Erro: {error.message}</div>
  ),
});

type FormState = {
  supplier_name: string;
  amount: string;
  due_date: string;
};

const EMPTY_FORM: FormState = { supplier_name: "", amount: "", due_date: "" };

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [meta, b64] = result.split(",");
      const mime = meta.match(/data:(.*?);base64/)?.[1] ?? file.type ?? "image/jpeg";
      resolve({ base64: b64, mimeType: mime });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function AccountsPayablePage() {
  const { profile } = useProfile();
  const qc = useQueryClient();
  const ocr = useServerFn(ocrBill);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [scanning, setScanning] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [preview, setPreview] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["accounts_payable", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts_payable")
        .select("*")
        .eq("company_id", profile!.company_id!)
        .order("due_date", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleFile = async (file: File) => {
    setPreview(URL.createObjectURL(file));
    setScanning(true);
    try {
      const { base64, mimeType } = await fileToBase64(file);
      const result: OcrBillResult = await ocr({ data: { imageBase64: base64, mimeType } });
      setForm({
        supplier_name: result.supplier_name ?? "",
        amount: result.amount != null ? String(result.amount) : "",
        due_date: result.due_date ?? "",
      });
      toast.success("Boleto lido! Revise os campos e salve.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha ao ler o boleto";
      toast.error(msg);
    } finally {
      setScanning(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id) throw new Error("Perfil sem empresa vinculada");
      if (!form.supplier_name.trim()) throw new Error("Informe o fornecedor");
      const amountNum = Number(form.amount.replace(",", "."));
      if (!isFinite(amountNum) || amountNum <= 0) throw new Error("Valor inválido");
      if (!form.due_date) throw new Error("Informe a data de vencimento");

      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("accounts_payable").insert({
        company_id: profile.company_id,
        unit_id: profile.unit_id,
        supplier_name: form.supplier_name.trim(),
        amount: amountNum,
        due_date: form.due_date,
        status: "pending",
        created_by: userData.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conta salva com sucesso!");
      setForm(EMPTY_FORM);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["accounts_payable"] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    },
  });

  const reset = () => {
    setForm(EMPTY_FORM);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  if (!profile) return <Loading />;

  return (
    <MobileShell profile={profile} title="Contas a Pagar" subtitle="Escaneie boletos com IA">
      <div className="p-4 space-y-4 pb-24 max-w-md mx-auto">
        <header>
          <h1 className="text-xl font-bold">Contas a Pagar</h1>
          <p className="text-sm text-muted-foreground">
            Escaneie o boleto com a câmera e a IA preenche para você.
          </p>
        </header>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />

        {!preview && (
          <Button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={scanning}
            className="w-full h-32 flex-col gap-2 text-base bg-[color:var(--franqos-blue)] hover:bg-[color:var(--franqos-blue)]/90"
          >
            <Camera size={32} />
            <span>Escanear Boleto / Conta</span>
          </Button>
        )}

        {preview && (
          <Card className="p-3 space-y-3">
            <img
              src={preview}
              alt="Prévia do boleto"
              className="w-full max-h-64 object-contain rounded-md bg-muted"
            />
            {scanning ? (
              <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="animate-spin" size={18} />
                Lendo boleto com IA...
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={reset} className="w-full">
                <RefreshCcw size={14} className="mr-2" /> Escanear outro
              </Button>
            )}
          </Card>
        )}

        {(preview || form.supplier_name || form.amount || form.due_date) && !scanning && (
          <Card className="p-4 space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <FileText size={16} /> Revise os dados
            </h2>

            <div className="space-y-1.5">
              <Label htmlFor="supplier" className="flex items-center gap-1.5">
                <Building2 size={14} /> Fornecedor
              </Label>
              <Input
                id="supplier"
                value={form.supplier_name}
                onChange={(e) => setForm((f) => ({ ...f, supplier_name: e.target.value }))}
                placeholder="Ex: Companhia de Energia"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="amount" className="flex items-center gap-1.5">
                <DollarSign size={14} /> Valor (R$)
              </Label>
              <Input
                id="amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="due" className="flex items-center gap-1.5">
                <Calendar size={14} /> Vencimento
              </Label>
              <Input
                id="due"
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </div>

            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="w-full"
            >
              {saveMutation.isPending ? (
                <Loader2 className="animate-spin mr-2" size={16} />
              ) : (
                <Save size={16} className="mr-2" />
              )}
              Salvar Conta
            </Button>
          </Card>
        )}

        <section className="space-y-2 pt-2">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Últimas contas
          </h2>
          {listQuery.isPending ? (
            <Skeleton className="h-20 w-full" />
          ) : listQuery.data && listQuery.data.length > 0 ? (
            <div className="space-y-2">
              {listQuery.data.map((row) => (
                <Card key={row.id} className="p-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{row.supplier_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Vence em {new Date(row.due_date).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {Number(row.amount).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </p>
                    <Badge variant={row.status === "paid" ? "default" : "secondary"} className="text-[10px]">
                      {row.status === "paid" ? "Pago" : "Pendente"}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada ainda.</p>
          )}
        </section>
      </div>
    </MobileShell>
  );
}
