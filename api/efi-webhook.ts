import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticate, createMtlsAgent, verifyAndConfirmPayment } from "./efi.js";

// Callbacks only suggest txids. The authenticated Efí API is the payment authority.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }
  let body: unknown;
  try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ success: false, error: "JSON inválido" }); }
  if (!body || typeof body !== "object" || !("pix" in body) || !Array.isArray(body.pix) || body.pix.length > 20) {
    return res.status(400).json({ success: false, error: "Notificação inválida" });
  }
  const txids: string[] = [];
  for (const payment of body.pix) {
    if (!payment || typeof payment.txid !== "string" || !/^[A-Za-z0-9]{26,35}$/.test(payment.txid)) {
      return res.status(400).json({ success: false, error: "Txid inválido" });
    }
    txids.push(payment.txid);
  }
  try {
    const agent = createMtlsAgent();
    const token = await authenticate(agent);
    for (const txid of new Set(txids)) await verifyAndConfirmPayment(txid, agent, token);
    return res.status(200).json({ received: true });
  } catch {
    return res.status(503).json({ success: false, error: "Não foi possível verificar o pagamento. A notificação pode ser reenviada." });
  }
}