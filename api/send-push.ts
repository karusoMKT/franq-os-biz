import type { VercelRequest, VercelResponse } from "@vercel/node";
import webpush from "web-push";
import { supabaseRequest } from "./efi.js";

// Callers: internal jobs with x-push-secret (any company), or a signed-in owner/manager (own company only).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return res.status(500).json({ success: false, error: "VAPID não configurado" });
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:contato@franqos.app", pub, priv);

  let body: any;
  try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ success: false, error: "JSON inválido" }); }
  const title = typeof body?.title === "string" ? body.title.slice(0, 120) : "";
  const message = typeof body?.body === "string" ? body.body.slice(0, 500) : "";
  const url = typeof body?.url === "string" && body.url.startsWith("/") ? body.url.slice(0, 200) : "/dashboard";
  const uuid = /^[0-9a-f-]{36}$/i;
  let companyId = typeof body?.company_id === "string" && uuid.test(body.company_id) ? body.company_id : null;
  const userId = typeof body?.user_id === "string" && uuid.test(body.user_id) ? body.user_id : null;
  if (!title) return res.status(400).json({ success: false, error: "Título obrigatório" });

  try {
    const secret = process.env.PUSH_API_SECRET;
    const given = req.headers["x-push-secret"];
    if (!(secret && given === secret)) {
      const token = String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "").trim();
      if (!token) return res.status(401).json({ success: false, error: "Não autorizado" });
      const user = await supabaseRequest("/auth/v1/user", { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
      if (typeof user?.id !== "string") return res.status(401).json({ success: false, error: "Sessão inválida" });
      const prof = await supabaseRequest(`/rest/v1/profiles?select=company_id,role&user_id=eq.${user.id}`);
      const p = prof?.[0];
      if (!p?.company_id || !["owner", "manager"].includes(p.role)) return res.status(403).json({ success: false, error: "Sem permissão" });
      companyId = p.company_id;
    }
    if (!companyId && !userId) return res.status(400).json({ success: false, error: "Informe company_id ou user_id" });

    const filters = [companyId ? `company_id=eq.${companyId}` : "", userId ? `user_id=eq.${userId}` : ""].filter(Boolean).join("&");
    const subs: Array<{ id: string; endpoint: string; p256dh: string; auth: string }> =
      (await supabaseRequest(`/rest/v1/push_subscriptions?select=id,endpoint,p256dh,auth&${filters}`)) ?? [];
    const payload = JSON.stringify({ title, body: message, url });
    let sent = 0;
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        sent++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await supabaseRequest(`/rest/v1/push_subscriptions?id=eq.${s.id}`, { method: "DELETE" }).catch(() => undefined);
        }
      }
    }));
    return res.status(200).json({ success: true, sent, total: subs.length });
  } catch {
    return res.status(503).json({ success: false, error: "Falha ao enviar notificações" });
  }
}
