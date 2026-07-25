import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Loader2, Save, Building2, Calendar, DollarSign, RefreshCcw } from "lucide-react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/hooks/use-profile";

type OcrBillResult = {
  supplier_name: string | null;
  amount: number | null;
  due_date: string | null;
};

const GEMINI_API_KEY = "AQ.Ab8RN6L1a2WrmN1djzPB97HtDLrkWStLoFsh7XRi6V7UTNAHTg";

async function ocrBillClient(
  base64Data: string,
  mimeType: string,
): Promise<OcrBillResult> {
  const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, "");

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

    const prompt =
      "Você é um assistente financeiro. Leia este boleto ou conta de consumo e retorne estritamente um JSON válido com as chaves: 'supplier_name' (string), 'amount' (number, use ponto decimal, sem R$) e 'due_date' (YYYY-MM-DD). Se não achar algo, retorne null. Retorne APENAS o JSON, sem formatação markdown.";

    const imagePart = {
      inlineData: {
        data: cleanBase64,
        mimeType: mimeType || "image/jpeg",
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const text = result.response.text();
    const cleanJsonText = text.replace(/```json/g, "").replace(/```/g, "").trim();

    let parsed: Partial<OcrBillResult> = {};
    try {
      parsed = JSON.parse(cleanJsonText);
    } catch {
      const match = cleanJsonText.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }

    return {
      supplier_name:
        typeof parsed.supplier_name === "string" ? parsed.supplier_name : null,
      amount:
        typeof parsed.amount === "number"
          ? parsed.amount
          : parsed.amount != null && !isNaN(Number(parsed.amount))
            ? Number(parsed.amount)
            : null,
      due_date:
        typeof parsed.due_date === "string" ? parsed.due_date : null,
    };
  } catch (error) {
    console.error("Erro no SDK do Gemini:", error);
    throw new Error(
      error instanceof Error ? error.message : "Falha ao ler o boleto com o SDK.",
    );
  }
}


type FormState = { supplier_name: string; amount: string; due_date: string };
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

export function BillScannerButton({ profile }: { profile: Profile }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const qc = useQueryClient();

  const reset = () => {
    setForm(EMPTY_FORM);
    setPreview(null);
    setScanning(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    setPreview(URL.createObjectURL(file));
    setOpen(true);
    setScanning(true);
    try {
      const { base64, mimeType } = await fileToBase64(file);
      const result = await ocrBillClient(base64, mimeType);
      setForm({
        supplier_name: result.supplier_name ?? "",
        amount: result.amount != null ? String(result.amount) : "",
        due_date: result.due_date ?? "",
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Falha ao ler o boleto");
    } finally {
      setScanning(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!profile.company_id) throw new Error("Perfil sem empresa vinculada");
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
      qc.invalidateQueries({ queryKey: ["accounts_payable"] });
      setOpen(false);
      reset();
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    },
  });

  return (
    <>
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
      <Button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full h-14 bg-[color:var(--franqos-blue)] hover:bg-[color:var(--franqos-blue)]/90"
      >
        <Camera size={20} className="mr-2" />
        Escanear Boleto / Conta
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo boleto</DialogTitle>
            <DialogDescription>
              Revise os dados lidos pela IA e salve a conta.
            </DialogDescription>
          </DialogHeader>

          {preview && (
            <img
              src={preview}
              alt="Prévia do boleto"
              className="w-full max-h-48 object-contain rounded-md bg-muted"
            />
          )}

          {scanning ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="animate-spin" size={18} />
              Lendo boleto com IA...
            </div>
          ) : (
            <div className="space-y-3">
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

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    reset();
                    inputRef.current?.click();
                  }}
                  className="flex-1"
                >
                  <RefreshCcw size={14} className="mr-2" /> Escanear outro
                </Button>
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="flex-1"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="animate-spin mr-2" size={16} />
                  ) : (
                    <Save size={16} className="mr-2" />
                  )}
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
