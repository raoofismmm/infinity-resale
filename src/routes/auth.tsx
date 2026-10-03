import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Infinity as InfinityIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { resetPasswordWithPin, setRecoveryPin } from "@/lib/recovery.functions";
import { normalizePhone, phoneToEmail, useAuth } from "@/lib/auth";

type Search = { mode?: "login" | "register" | "forgot" };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    mode: search['mode'] === "register" ? "register" : search['mode'] === "forgot" ? "forgot" : "login",
  }),
  head: () => ({
    meta: [
      { title: "Log in or register — INFINITYRESALE" },
      { name: "description", content: "Sign in to INFINITYRESALE with your phone number to list items for sale." },
      { property: "og:title", content: "Log in or register — INFINITYRESALE" },
      { property: "og:description", content: "Phone number sign-in for buyers and sellers on INFINITYRESALE." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isRegister = mode === "register";
  const isForgot = mode === "forgot";
  const [pin, setPin] = useState("");
  const savePin = useServerFn(setRecoveryPin);
  const resetPw = useServerFn(resetPasswordWithPin);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user && !busy) void navigate({ to: "/", replace: true });
  }, [user, busy, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const digits = normalizePhone(phone);
    if (digits.length < 8) { toast.error("Enter a valid phone number"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if ((isRegister || isForgot) && !/^\d{4}$/.test(pin)) { toast.error("Recovery PIN must be exactly 4 digits"); return; }
    setBusy(true);
    try {
      if (isForgot) {
        const res = await resetPw({ data: { phone: digits, pin, password } });
        if (!res.ok) throw new Error(res.error);
        toast.success("Password reset. Please log in.");
        setPassword(""); setPin("");
        void navigate({ to: "/auth", search: { mode: "login" } });
        return;
      }
      if (isRegister) {
        const { data: signed, error } = await supabase.auth.signUp({
          email: phoneToEmail(digits),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              phone: digits,
              display_name: name || digits,
              whatsapp: normalizePhone(whatsapp) || digits,
            },
          },
        });
        if (error) throw error;
        if (signed.session) await savePin({ data: { pin } });
        toast.success("Account created");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: phoneToEmail(digits),
          password,
        });
        if (error) throw error;
        toast.success("Welcome back");
      }
      void navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-[80vh] max-w-md place-items-center px-4 py-10">
      <div className="card-surface w-full space-y-5 p-7">
        <div className="space-y-1 text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
            <InfinityIcon className="size-6" />
          </span>
          <h1 className="pt-2 text-2xl font-bold">{isForgot ? "Reset your password" : isRegister ? "Create your account" : "Welcome back"}</h1>
          <p className="text-sm text-muted-foreground">
            {isForgot ? "Enter your phone number and 4-digit recovery PIN." : "Phone number and password — that's all."}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            className="field"
            placeholder="Phone number"
            inputMode="numeric"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {isRegister && (
            <>
              <input
                className="field"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className="field"
                placeholder="WhatsApp number (leave empty to use the same)"
                inputMode="numeric"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
              />
            </>
          )}
          {(isRegister || isForgot) && (
            <div className="space-y-1">
              {isRegister && (
                <p className="pt-1 text-xs font-semibold text-muted-foreground">
                  Password recovery — set a 4-digit PIN. You'll need it if you forget your password.
                </p>
              )}
              <input
                className="field tracking-[0.4em]"
                type="password"
                placeholder={isRegister ? "Set 4-digit recovery PIN" : "4-digit recovery PIN"}
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              />
            </div>
          )}
          <input
            className="field"
            type="password"
            placeholder={isForgot ? "New password" : "Password"}
            autoComplete={isRegister || isForgot ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button disabled={busy} className="btn-primary w-full">
            {busy ? "Please wait..." : isForgot ? "Reset password" : isRegister ? "Register" : "Log in"}
          </button>
          {!isRegister && !isForgot && (
            <button
              type="button"
              className="block w-full text-right text-xs text-primary hover:underline"
              onClick={() => navigate({ to: "/auth", search: { mode: "forgot" } })}
            >
              Forgot password?
            </button>
          )}
        </form>

        <button
          className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => navigate({ to: "/auth", search: { mode: isRegister || isForgot ? "login" : "register" } })}
        >
          {isForgot ? "Back to log in" : isRegister ? "Already have an account? Log in" : "New here? Create an account"}
        </button>
      </div>
    </main>
  );
}
