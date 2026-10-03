CREATE TABLE public.recovery_pins (
  user_id uuid PRIMARY KEY,
  pin_hash text NOT NULL,
  failed_attempts int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.recovery_pins TO service_role;
ALTER TABLE public.recovery_pins ENABLE ROW LEVEL SECURITY;