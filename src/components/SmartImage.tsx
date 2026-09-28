import { useEffect, useState } from "react";
import { signedUrl } from "@/lib/images";

export function SmartImage({
  path,
  alt,
  className,
}: {
  path: string | undefined;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    let active = true;
    if (!path) {
      setUrl("");
      return;
    }
    void signedUrl(path).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [path]);

  if (!url) {
    return <div className={`animate-pulse bg-muted ${className ?? ""}`} aria-label={alt} />;
  }
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}
