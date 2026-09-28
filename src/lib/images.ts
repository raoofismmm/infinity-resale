import { supabase } from "@/integrations/supabase/client";

const BUCKET = "product-images";
const cache = new Map<string, string>();

export async function signedUrl(path: string): Promise<string> {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const hit = cache.get(path);
  if (hit) return hit;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 6);
  const url = data?.signedUrl ?? "";
  if (url) cache.set(path, url);
  return url;
}

export async function uploadProductImage(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

export function formatPrice(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}
