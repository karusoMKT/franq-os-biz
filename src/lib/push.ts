import { supabase } from "@/integrations/supabase/client";

const FALLBACK_VAPID_PUBLIC_KEY =
  "BOA_lr117vg8J7_yvcAUMPY3QEfD7_cyq9-x5YxLlpshxp2CRCVAnbN5yMZvYPHmGsI0N9DRNUkj2HXkDoUBjZY";

export function getVapidPublicKey() {
  const env = import.meta.env as Record<string, string | undefined>;
  return env.VAPID_PUBLIC_KEY || env.VITE_VAPID_PUBLIC_KEY || FALLBACK_VAPID_PUBLIC_KEY;
}

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function enablePush(userId: string, companyId: string | null) {
  if (!pushSupported()) throw new Error("Este navegador não suporta notificações. No iPhone, adicione o app à Tela de Início primeiro.");
  if (!VAPID_PUBLIC_KEY) throw new Error("Notificações ainda não configuradas (chave pública ausente).");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Permissão de notificações negada.");
  const reg = await navigator.serviceWorker.register("/push-sw.js", { scope: "/push/" });
  await navigator.serviceWorker.ready.catch(() => undefined);
  const sub = (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }));
  const json = sub.toJSON();
  const { error } = await supabase.from("push_subscriptions" as never).upsert(
    {
      user_id: userId,
      company_id: companyId,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
      user_agent: navigator.userAgent.slice(0, 300),
    } as never,
    { onConflict: "endpoint" },
  );
  if (error) throw new Error("Não foi possível salvar este aparelho.");
}

export async function isPushActive() {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.getRegistration("/push/");
  return !!(await reg?.pushManager.getSubscription());
}
