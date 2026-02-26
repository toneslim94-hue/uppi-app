-- ============================================================
-- UPPI - Tabelas Faltantes (Subscriptions, Group Rides, Scheduled Rides, etc)
-- ============================================================

-- ============================================================
-- SUBSCRIPTIONS (Club Uppi)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'expired', 'paused');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE subscription_tier AS ENUM ('basic', 'premium', 'vip');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tier subscription_tier NOT NULL,
  status subscription_status NOT NULL DEFAULT 'active',
  price DECIMAL(10,2) NOT NULL,
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  auto_renew BOOLEAN DEFAULT true,
  benefits JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "subscriptions_insert_own" ON public.subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "subscriptions_update_own" ON public.subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SCHEDULED RIDES (Corridas Agendadas)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.scheduled_rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID REFERENCES public.rides(id) ON DELETE CASCADE,
  passenger_id UUID NOT NULL REFERENCES public.profiles(id),
  pickup_address TEXT NOT NULL,
  pickup_lat DECIMAL(10,8) NOT NULL,
  pickup_lng DECIMAL(11,8) NOT NULL,
  dropoff_address TEXT NOT NULL,
  dropoff_lat DECIMAL(10,8) NOT NULL,
  dropoff_lng DECIMAL(11,8) NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  vehicle_type vehicle_type,
  notes TEXT,
  status TEXT DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.scheduled_rides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scheduled_rides_select_own" ON public.scheduled_rides
  FOR SELECT USING (auth.uid() = passenger_id);
CREATE POLICY "scheduled_rides_insert_own" ON public.scheduled_rides
  FOR INSERT WITH CHECK (auth.uid() = passenger_id);
CREATE POLICY "scheduled_rides_update_own" ON public.scheduled_rides
  FOR UPDATE USING (auth.uid() = passenger_id);
CREATE POLICY "scheduled_rides_delete_own" ON public.scheduled_rides
  FOR DELETE USING (auth.uid() = passenger_id);

DROP TRIGGER IF EXISTS update_scheduled_rides_updated_at ON public.scheduled_rides;
CREATE TRIGGER update_scheduled_rides_updated_at
  BEFORE UPDATE ON public.scheduled_rides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- GROUP RIDES (Corridas em Grupo)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE group_ride_status AS ENUM ('open', 'full', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.group_rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID REFERENCES public.rides(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.profiles(id),
  max_passengers INTEGER NOT NULL DEFAULT 4,
  current_passengers INTEGER DEFAULT 1,
  pickup_address TEXT NOT NULL,
  pickup_lat DECIMAL(10,8) NOT NULL,
  pickup_lng DECIMAL(11,8) NOT NULL,
  dropoff_address TEXT NOT NULL,
  dropoff_lat DECIMAL(10,8) NOT NULL,
  dropoff_lng DECIMAL(11,8) NOT NULL,
  departure_time TIMESTAMPTZ NOT NULL,
  price_per_person DECIMAL(10,2),
  status group_ride_status DEFAULT 'open',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.group_rides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_rides_select_all" ON public.group_rides
  FOR SELECT USING (true);
CREATE POLICY "group_rides_insert_own" ON public.group_rides
  FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "group_rides_update_creator" ON public.group_rides
  FOR UPDATE USING (auth.uid() = creator_id);

DROP TRIGGER IF EXISTS update_group_rides_updated_at ON public.group_rides;
CREATE TRIGGER update_group_rides_updated_at
  BEFORE UPDATE ON public.group_rides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- GROUP RIDE PARTICIPANTS (Participantes de Corridas em Grupo)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.group_ride_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_ride_id UUID NOT NULL REFERENCES public.group_rides(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  status TEXT DEFAULT 'confirmed',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_ride_id, user_id)
);

ALTER TABLE public.group_ride_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_participants_select" ON public.group_ride_participants
  FOR SELECT USING (true);
CREATE POLICY "group_participants_insert" ON public.group_ride_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "group_participants_delete_own" ON public.group_ride_participants
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- VEHICLES (Veículos dos Motoristas)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.driver_profiles(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  color TEXT NOT NULL,
  plate TEXT NOT NULL UNIQUE,
  vehicle_type vehicle_type NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicles_select_all" ON public.vehicles
  FOR SELECT USING (true);
CREATE POLICY "vehicles_manage_own" ON public.vehicles
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.driver_profiles WHERE id = driver_id)
  );

DROP TRIGGER IF EXISTS update_vehicles_updated_at ON public.vehicles;
CREATE TRIGGER update_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- DRIVER DOCUMENTS (Documentos dos Motoristas)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE document_type AS ENUM ('cnh', 'crlv', 'identity', 'selfie', 'vehicle_photo');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE document_status AS ENUM ('pending', 'approved', 'rejected', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.driver_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.driver_profiles(id) ON DELETE CASCADE,
  document_type document_type NOT NULL,
  document_url TEXT NOT NULL,
  status document_status DEFAULT 'pending',
  rejection_reason TEXT,
  expires_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver_docs_select_own" ON public.driver_documents
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM public.driver_profiles WHERE id = driver_id)
  );
CREATE POLICY "driver_docs_insert_own" ON public.driver_documents
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT id FROM public.driver_profiles WHERE id = driver_id)
  );
CREATE POLICY "driver_docs_update_own" ON public.driver_documents
  FOR UPDATE USING (
    auth.uid() IN (SELECT id FROM public.driver_profiles WHERE id = driver_id)
  );

DROP TRIGGER IF EXISTS update_driver_documents_updated_at ON public.driver_documents;
CREATE TRIGGER update_driver_documents_updated_at
  BEFORE UPDATE ON public.driver_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- USER SETTINGS (Configurações do Usuário)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Notifications
  push_notifications BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT true,
  sms_notifications BOOLEAN DEFAULT false,
  
  -- Privacy
  show_profile_picture BOOLEAN DEFAULT true,
  show_last_name BOOLEAN DEFAULT false,
  allow_ride_sharing BOOLEAN DEFAULT true,
  
  -- Preferences
  default_payment_method payment_method DEFAULT 'cash',
  preferred_vehicle_type vehicle_type DEFAULT 'economy',
  language TEXT DEFAULT 'pt-BR',
  theme TEXT DEFAULT 'system',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_settings_select_own" ON public.user_settings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_settings_insert_own" ON public.user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_settings_update_own" ON public.user_settings
  FOR UPDATE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RIDE RECORDINGS (Gravações de Áudio)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE recording_status AS ENUM ('recording', 'completed', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.ride_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  started_by UUID NOT NULL REFERENCES public.profiles(id),
  recording_url TEXT,
  duration_seconds INTEGER,
  status recording_status DEFAULT 'recording',
  consent_passenger BOOLEAN DEFAULT false,
  consent_driver BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ride_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ride_recordings_select_participants" ON public.ride_recordings
  FOR SELECT USING (
    auth.uid() IN (
      SELECT passenger_id FROM public.rides WHERE id = ride_id
      UNION
      SELECT driver_id FROM public.rides WHERE id = ride_id
    )
  );
CREATE POLICY "ride_recordings_insert" ON public.ride_recordings
  FOR INSERT WITH CHECK (auth.uid() = started_by);
CREATE POLICY "ride_recordings_update_participants" ON public.ride_recordings
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT passenger_id FROM public.rides WHERE id = ride_id
      UNION
      SELECT driver_id FROM public.rides WHERE id = ride_id
    )
  );

-- ============================================================
-- ACHIEVEMENTS CATALOG (Catálogo de Conquistas - dados fixos)
-- ============================================================
-- Inserir conquistas básicas se não existirem
INSERT INTO public.achievements (name, description, icon, type, requirement_value, points) VALUES
  ('Primeira Corrida', 'Complete sua primeira corrida no Uppi', '🚗', 'rides', 1, 10),
  ('Explorador', 'Complete 10 corridas', '🗺️', 'rides', 10, 50),
  ('Veterano', 'Complete 50 corridas', '⭐', 'rides', 50, 200),
  ('Mestre Uppi', 'Complete 100 corridas', '👑', 'rides', 100, 500),
  ('Avaliador', 'Dê 10 avaliações', '📝', 'ratings', 10, 30),
  ('Crítico', 'Dê 50 avaliações', '🏆', 'ratings', 50, 100),
  ('Economista', 'Economize R$50 em corridas', '💰', 'savings', 50, 50),
  ('Socialite', 'Faça 5 amigos no app', '👥', 'friends', 5, 40),
  ('Madrugador', 'Complete 5 corridas antes das 6h', '🌅', 'early_rides', 5, 60),
  ('Noturno', 'Complete 5 corridas depois das 22h', '🌙', 'night_rides', 5, 60),
  ('Compartilhador', 'Indique 5 amigos', '🎁', 'referrals', 5, 100),
  ('Leal', 'Use o app por 30 dias seguidos', '❤️', 'streak', 30, 150),
  ('Pontual', 'Seja pontual em 20 corridas', '⏰', 'punctuality', 20, 80),
  ('Comunicador', 'Envie 100 mensagens no chat', '💬', 'messages', 100, 40)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- USER STREAKS (Sequências de Uso)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_streaks_select_own" ON public.user_streaks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_streaks_update_own" ON public.user_streaks
  FOR UPDATE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_user_streaks_updated_at ON public.user_streaks;
CREATE TRIGGER update_user_streaks_updated_at
  BEFORE UPDATE ON public.user_streaks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SOCIAL FOLLOWS (Seguir Usuários)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.social_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

ALTER TABLE public.social_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social_follows_select" ON public.social_follows
  FOR SELECT USING (true);
CREATE POLICY "social_follows_insert" ON public.social_follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "social_follows_delete_own" ON public.social_follows
  FOR DELETE USING (auth.uid() = follower_id);

-- ============================================================
-- USER SOCIAL STATS (Estatísticas Sociais)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_social_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_social_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social_stats_select" ON public.user_social_stats
  FOR SELECT USING (true);

DROP TRIGGER IF EXISTS update_user_social_stats_updated_at ON public.user_social_stats;
CREATE TRIGGER update_user_social_stats_updated_at
  BEFORE UPDATE ON public.user_social_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();



-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Tabelas faltantes criadas com sucesso!';
  RAISE NOTICE '📊 Novas tabelas: subscriptions, scheduled_rides, group_rides, group_ride_participants';
  RAISE NOTICE '📊 Novas tabelas: vehicles, driver_documents, user_settings, ride_recordings';
  RAISE NOTICE '📊 Novas tabelas: user_streaks, social_follows, user_social_stats';
  RAISE NOTICE '🔒 RLS habilitado em todas as tabelas';
  RAISE NOTICE '🎯 Achievements populados com 14 conquistas';
END $$;
