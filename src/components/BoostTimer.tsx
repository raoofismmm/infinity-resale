import { useEffect, useState } from "react";
import { Zap } from "lucide-react";

function remaining(until: string) {
  const ms = new Date(until).getTime() - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function isBoosted(until: string | null | undefined) {
  return Boolean(until && new Date(until).getTime() > Date.now());
}

export function BoostTimer({ until, className }: { until: string; className?: string }) {
  const [label, setLabel] = useState<string | null>(() => remaining(until));

  useEffect(() => {
    const id = setInterval(() => setLabel(remaining(until)), 1000);
    setLabel(remaining(until));
    return () => clearInterval(id);
  }, [until]);

  if (!label) return null;
  return (
    <span
      className={`chip bg-boost/15 text-foreground ring-1 ring-boost/40 ${className ?? ""}`}
      title="Boost time left"
    >
      <Zap className="size-3.5 text-boost" />
      <span className="tabular-nums">{label}</span>
    </span>
  );
}
