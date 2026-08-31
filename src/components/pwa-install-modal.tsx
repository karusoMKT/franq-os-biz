import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Monitor, Smartphone, Apple } from "lucide-react";

const STORAGE_KEY = "franqos:pwa-onboarding-seen";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function detectPlatform(): "desktop" | "android" | "ios" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function PwaInstallModal() {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<"desktop" | "android" | "ios">("desktop");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPlatform(detectPlatform());

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    let seen = false;
    try {
      seen = window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      seen = false;
    }

    if (!seen && !isStandalone()) setOpen(true);

    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const markSeen = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const close = () => {
    markSeen();
    setOpen(false);
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      close();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Instale o FranqOS no seu dispositivo</DialogTitle>
          <DialogDescription>
            Acesse rapidamente direto da sua área de trabalho ou tela inicial sem precisar
            abrir o navegador.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={platform} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="desktop" className="text-xs">
              <Monitor className="mr-1 h-3.5 w-3.5" />
              Computador
            </TabsTrigger>
            <TabsTrigger value="android" className="text-xs">
              <Smartphone className="mr-1 h-3.5 w-3.5" />
              Android
            </TabsTrigger>
            <TabsTrigger value="ios" className="text-xs">
              <Apple className="mr-1 h-3.5 w-3.5" />
              iPhone
            </TabsTrigger>
          </TabsList>

          <TabsContent value="desktop" className="text-sm text-muted-foreground pt-3">
            Clique no ícone de instalar no canto superior direito da barra de endereço do
            navegador ou vá em Menu (3 pontos) &gt; Instalar FranqOS.
          </TabsContent>
          <TabsContent value="android" className="text-sm text-muted-foreground pt-3">
            Toque nos 3 pontos no canto superior direito e selecione Adicionar à tela
            inicial ou Instalar aplicativo.
          </TabsContent>
          <TabsContent value="ios" className="text-sm text-muted-foreground pt-3">
            Toque no botão de Compartilhar (ícone com quadrado e seta para cima) e
            selecione Adicionar à Tela de Início.
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {deferredPrompt && (
            <Button className="w-full" onClick={handleInstall}>
              Instalar agora
            </Button>
          )}
          <Button variant="outline" className="w-full" onClick={close}>
            Continuar para o App
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
