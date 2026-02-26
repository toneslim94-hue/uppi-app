-- ============================================================
-- PUSH SUBSCRIPTIONS (Web Push + VAPID)
-- Armazena as subscriptions do navegador para envio de push
-- notifications quando o app estiver fechado (PWA/TWA)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint      TEXT        NOT NULL,
  p256dh        TEXT        NOT NULL,
  auth          TEXT        NOT NULL,
  user_agent    TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON public.push_subscriptions (user_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active
  ON public.push_subscriptions (is_active);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Usuarios gerenciam apenas as proprias subscriptions
CREATE POLICY "push_subscriptions_manage_own"
  ON public.push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at automaticamente
DROP TRIGGER IF EXISTS update_push_subscriptions_updated_at
  ON public.push_subscriptions;

CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comentarios
COMMENT ON TABLE public.push_subscriptions IS
  'Subscriptions Web Push (VAPID) para notificacoes push nativas no PWA/TWA';
COMMENT ON COLUMN public.push_subscriptions.endpoint IS
  'URL unica do push service do navegador (Google FCM infra, Mozilla, etc.)';
COMMENT ON COLUMN public.push_subscriptions.p256dh IS
  'Chave publica do cliente para criptografia da mensagem';
COMMENT ON COLUMN public.push_subscriptions.auth IS
  'Segredo de autenticacao do cliente';
