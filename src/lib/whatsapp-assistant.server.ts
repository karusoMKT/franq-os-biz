// Server-only: roteador de intenções do assistente financeiro do WhatsApp.
// Usa o Gemini (gemini-1.5-flash) para classificar a mensagem e, quando for
// uma conta a pagar, grava direto na tabela accounts_payable.

export type Intent = "ADD_PAYABLE" | "ADD_TRANSACTION" | "QUERY_DATA" | "GENERAL_CHAT";

export type IntentResult = {
  intent: Intent;
  // ADD_PAYABLE
  due_date?: string | null;
  amount?: number | null;
  description?: string | null;
  // ADD_TRANSACTION
  transaction_type?: "income" | "expense" | null;
  category?: string | null;
  date?: string | null;
  // QUERY_DATA
  query_type?: string | null;
  date_range?: { start?: string | null; end?: string | null } | null;
  // GENERAL_CHAT
  reply?: string | null;
};

const SYSTEM_PROMPT = `Você é o roteador de intenções de um assistente financeiro de franquias (FranqOS), que conversa em português do Brasil pelo WhatsApp.

Classifique a mensagem do usuário em EXATAMENTE uma das quatro intenções e responda APENAS com um JSON válido, sem markdown, sem comentários.

1) ADD_PAYABLE — o usuário quer registrar/adicionar uma conta, boleto ou despesa a pagar.
   Formato:
   {"intent":"ADD_PAYABLE","due_date":"YYYY-MM-DD","amount":123.45,"description":"texto curto com o fornecedor/motivo"}
   - due_date: converta expressões relativas ("hoje", "amanhã", "dia 10", "sexta") para data absoluta usando a DATA DE HOJE informada. Se o dia informado já passou neste mês, use o mês seguinte.
   - amount: número com ponto decimal, sem "R$" e sem separador de milhar.
   - Se algum campo não for identificável, use null.

2) ADD_TRANSACTION — o usuário informa uma receita/faturamento já realizado ou uma despesa já paga (sem vencimento futuro).
   Formato:
   {"intent":"ADD_TRANSACTION","transaction_type":"income|expense","amount":123.45,"category":"categoria curta","description":"texto curto","date":"YYYY-MM-DD"}
   - date: use a DATA DE HOJE quando não for informada.
   - amount: número com ponto decimal, sem "R$" e sem separador de milhar.

3) QUERY_DATA — o usuário pergunta algo sobre o negócio (faturamento, despesas, boletos, metas).
   Formato:
   {"intent":"QUERY_DATA","query_type":"revenue|expenses|payables|balance|other","date_range":{"start":"YYYY-MM-DD","end":"YYYY-MM-DD"}}
   - Interprete períodos ("hoje", "essa semana", "esse mês") em datas absolutas a partir da DATA DE HOJE.

4) GENERAL_CHAT — saudações, agradecimentos ou qualquer outra coisa.
   Formato:
   {"intent":"GENERAL_CHAT","reply":"resposta curta e cordial em português"}`;

function geminiKey() {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new Error("GEMINI_API_KEY não configurada");
  return key;
}

function parseJson(text: string): IntentResult {
  const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(clean) as IntentResult;
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as IntentResult;
    return { intent: "GENERAL_CHAT", reply: "Não entendi, pode repetir?" };
  }
}

const MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"];

export async function classifyMessage(message: string): Promise<IntentResult> {
  const today = new Date().toISOString().slice(0, 10);
  const key = geminiKey();
  let lastError: unknown = null;

  for (const model of MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: `${SYSTEM_PROMPT}\n\nDATA DE HOJE: ${today}` }],
          },
          contents: [{ role: "user", parts: [{ text: message }] }],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      lastError = new Error(`Gemini ${model} ${res.status}: ${body.slice(0, 300)}`);
      continue;
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = parseJson(text);
    if (!["ADD_PAYABLE", "ADD_TRANSACTION", "QUERY_DATA", "GENERAL_CHAT"].includes(parsed.intent)) {
      return { intent: "GENERAL_CHAT", reply: "Não entendi, pode repetir?" };
    }
    return parsed;
  }

  throw lastError ?? new Error("Falha ao consultar a IA");
}


const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const ptDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

/** Resolve a empresa/unidade do remetente. Sem cadastro de telefone ainda,
 *  aceitamos company_id/unit_id no payload e caímos para a 1ª empresa. */
async function resolveScope(input: { company_id?: string; unit_id?: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (input.company_id) {
    return { company_id: input.company_id, unit_id: input.unit_id ?? null };
  }
  const { data } = await supabaseAdmin
    .from("companies")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error("Nenhuma empresa encontrada");

  let unit_id = input.unit_id ?? null;
  if (!unit_id) {
    const { data: unit } = await supabaseAdmin
      .from("units")
      .select("id")
      .eq("company_id", data.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    unit_id = unit?.id ?? null;
  }
  return { company_id: data.id, unit_id };
}

export async function handleWhatsappMessage(input: {
  message: string;
  company_id?: string;
  unit_id?: string;
}): Promise<{ intent: Intent; reply: string; data: IntentResult }> {
  const result = await classifyMessage(input.message);

  if (result.intent === "ADD_PAYABLE") {
    if (!result.amount || !result.due_date) {
      return {
        intent: result.intent,
        data: result,
        reply:
          "Entendi que é uma conta a pagar, mas faltou o valor ou a data de vencimento. Ex: \"Boleto da Coelha de R$ 1.200 para o dia 10\".",
      };
    }
    const scope = await resolveScope(input);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const supplier = (result.description ?? "").trim() || "Conta via WhatsApp";
    const { error } = await supabaseAdmin.from("accounts_payable").insert({
      company_id: scope.company_id,
      unit_id: scope.unit_id,
      supplier_name: supplier,
      amount: result.amount,
      due_date: result.due_date,
      status: "pending",
    });
    if (error) throw new Error(error.message);

    return {
      intent: result.intent,
      data: result,
      reply: `Conta "${supplier}" de ${brl(result.amount)} adicionada com sucesso para o dia ${ptDate(result.due_date)}!`,
    };
  }

  if (result.intent === "ADD_TRANSACTION") {
    if (!result.amount || !result.transaction_type) {
      return {
        intent: result.intent,
        data: result,
        reply:
          "Entendi que é um lançamento financeiro, mas faltou o valor ou o tipo (receita/despesa).",
      };
    }
    const scope = await resolveScope(input);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const date = result.date ?? new Date().toISOString().slice(0, 10);
    const { error } = await supabaseAdmin.from("transactions").insert({
      unit_id: scope.unit_id,
      type: result.transaction_type,
      category:
        result.category?.trim() ||
        (result.transaction_type === "income" ? "Faturamento" : "Outros"),
      amount: result.amount,
      date,
      description: result.description?.trim() || null,
    });
    if (error) throw new Error(error.message);
    return {
      intent: result.intent,
      data: result,
      reply: `${result.transaction_type === "income" ? "Receita" : "Despesa"} de ${brl(result.amount)} lançada em ${ptDate(date)}.`,
    };
  }

  if (result.intent === "QUERY_DATA") {
    const reply = await answerQuery(result, input);
    return { intent: result.intent, data: result, reply };
  }

  return {
    intent: "GENERAL_CHAT",
    data: result,
    reply:
      result.reply?.trim() ||
      "Posso registrar contas a pagar e responder sobre faturamento, despesas e boletos. É só me dizer!",
  };
}

async function answerQuery(
  result: IntentResult,
  input: { company_id?: string; unit_id?: string },
): Promise<string> {
  const scope = await resolveScope(input);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const today = new Date().toISOString().slice(0, 10);
  const start = result.date_range?.start ?? today.slice(0, 8) + "01";
  const end = result.date_range?.end ?? today;

  if (result.query_type === "payables") {
    let q = supabaseAdmin
      .from("accounts_payable")
      .select("supplier_name, amount, due_date, status")
      .eq("company_id", scope.company_id)
      .gte("due_date", start)
      .lte("due_date", end)
      .order("due_date");
    if (scope.unit_id) q = q.eq("unit_id", scope.unit_id);
    const { data } = await q;
    const rows = data ?? [];
    if (rows.length === 0) return `Nenhum boleto entre ${ptDate(start)} e ${ptDate(end)}.`;
    const total = rows.reduce((s, r) => s + Number(r.amount), 0);
    const lines = rows
      .map((r) => `• ${r.supplier_name} — ${brl(Number(r.amount))} (${ptDate(r.due_date)})${r.status === "paid" ? " ✅" : ""}`)
      .join("\n");
    return `Boletos de ${ptDate(start)} a ${ptDate(end)} — total ${brl(total)}:\n${lines}`;
  }

  // revenue | expenses | balance | other -> usa a tabela transactions
  let q = supabaseAdmin
    .from("transactions")
    .select("type, amount, date")
    .gte("date", start)
    .lte("date", end);
  if (scope.unit_id) q = q.eq("unit_id", scope.unit_id);
  const { data } = await q;
  const rows = data ?? [];
  const income = rows.filter((r) => r.type === "income").reduce((s, r) => s + Number(r.amount), 0);
  const expense = rows.filter((r) => r.type === "expense").reduce((s, r) => s + Number(r.amount), 0);

  const period = `${ptDate(start)} a ${ptDate(end)}`;
  if (result.query_type === "revenue") return `Faturamento de ${period}: ${brl(income)}.`;
  if (result.query_type === "expenses") return `Despesas de ${period}: ${brl(expense)}.`;
  return `Resumo de ${period}:\n• Faturamento: ${brl(income)}\n• Despesas: ${brl(expense)}\n• Saldo: ${brl(income - expense)}`;
}
