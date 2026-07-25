export function FranqosLogo({
  className = "h-16 w-16",
  alt = "FranqOS",
}: {
  className?: string;
  alt?: string;
}) {
  return <img src="/franqos-mark.png" alt={alt} className={className} loading="eager" />;
}

export function FranqosLockup({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
  const dims = {
    sm: { box: "h-12 w-12 rounded-xl p-2", text: "text-base" },
    md: { box: "h-16 w-16 rounded-2xl p-3", text: "text-xl" },
    lg: { box: "h-24 w-24 rounded-3xl p-4", text: "text-3xl" },
  }[size];
  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`${dims.box} bg-white shadow-xl flex items-center justify-center`}>
        <img src="/franqos-mark.png" alt="FranqOS" className="w-full h-full object-contain" loading="eager" />
      </div>
      <div className={`${dims.text} font-extrabold tracking-tight text-white`}>
        Franq<span className="text-sky-400">OS</span>
      </div>
    </div>
  );
}
