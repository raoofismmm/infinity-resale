import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Settings = {
  popup_enabled: boolean;
  popup_title: string;
  popup_body: string;
  popup_image_url: string | null;
  popup_link_url: string | null;
};

export function WelcomePopup() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void supabase
      .from("site_settings")
      .select("popup_enabled, popup_title, popup_body, popup_image_url, popup_link_url")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.popup_enabled) {
          setSettings(data as Settings);
          setOpen(true);
        }
      });
  }, []);

  if (!open || !settings) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/45 p-4 backdrop-blur-sm">
      <div className="card-surface relative w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
        <button
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-card/90 text-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>
        {settings.popup_image_url && (
          <img src={settings.popup_image_url} alt="" className="max-h-64 w-full object-cover" />
        )}
        <div className="space-y-3 p-6">
          <h2 className="text-xl font-bold">{settings.popup_title}</h2>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{settings.popup_body}</p>
          <div className="flex gap-2 pt-1">
            {settings.popup_link_url && (
              <a href={settings.popup_link_url} target="_blank" rel="noreferrer" className="btn-primary">
                Learn more
              </a>
            )}
            <button onClick={() => setOpen(false)} className="btn-outline">
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
