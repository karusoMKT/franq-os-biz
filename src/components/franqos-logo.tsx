import logo from "@/assets/franqos-logo.asset.json";

export function FranqosLogo({ className = "h-16 w-16", alt = "FranqOS" }: { className?: string; alt?: string }) {
  return <img src={logo.url} alt={alt} className={className} loading="eager" />;
}
