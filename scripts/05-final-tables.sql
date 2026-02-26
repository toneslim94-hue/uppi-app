-- =====================================================
-- SCRIPT 05: TABELAS FINAIS FALTANTES
-- Data: 23/02/2026
-- Descrição: Cria apenas as tabelas que ainda não existem
-- =====================================================

-- Tabela: subscriptions (Club Uppi)
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('free', 'silver', 'gold', 'platinum')),
  status TEXT NOT NULL CHECK (status IN ('active', 'cancelled', 'expired')),
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  auto_renew BOOLEAN DEFAULT true,
  price DECIMAL(10,2) NOT NULL,
  features JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- RLS para subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
  ON subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- Tabela: scheduled_rides (Corridas Agendadas)
CREATE TABLE IF NOT EXISTS scheduled_rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pickup_location GEOGRAPHY(POINT) NOT NULL,
  pickup_address TEXT NOT NULL,
  dropoff_location GEOGRAPHY(POINT) NOT NULL,
  dropoff_address TEXT NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  vehicle_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'cancelled', 'completed')),
  ride_id UUID REFERENCES rides(id) ON DELETE SET NULL,
  estimated_price DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scheduled_rides_user_id ON scheduled_rides(user_id);
CREATE INDEX idx_scheduled_rides_scheduled_time ON scheduled_rides(scheduled_time);
CREATE INDEX idx_scheduled_rides_status ON scheduled_rides(status);

-- RLS para scheduled_rides
ALTER TABLE scheduled_rides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scheduled rides"
  ON scheduled_rides FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create scheduled rides"
  ON scheduled_rides FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scheduled rides"
  ON scheduled_rides FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scheduled rides"
  ON scheduled_rides FOR DELETE
  USING (auth.uid() = user_id);

-- Tabela: group_rides (Corridas em Grupo)
CREATE TABLE IF NOT EXISTS group_rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ride_id UUID REFERENCES rides(id) ON DELETE SET NULL,
  pickup_location GEOGRAPHY(POINT) NOT NULL,
  pickup_address TEXT NOT NULL,
  dropoff_location GEOGRAPHY(POINT) NOT NULL,
  dropoff_address TEXT NOT NULL,
  max_participants INTEGER NOT NULL DEFAULT 4,
  current_participants INTEGER DEFAULT 1,
  price_per_person DECIMAL(10,2),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'full', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  departure_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_group_rides_organizer_id ON group_rides(organizer_id);
CREATE INDEX idx_group_rides_status ON group_rides(status);
CREATE INDEX idx_group_rides_departure_time ON group_rides(departure_time);

-- RLS para group_rides
ALTER TABLE group_rides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view open group rides"
  ON group_rides FOR SELECT
  USING (status = 'open' OR auth.uid() = organizer_id);

CREATE POLICY "Users can create group rides"
  ON group_rides FOR INSERT
  WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Organizers can update group rides"
  ON group_rides FOR UPDATE
  USING (auth.uid() = organizer_id);

-- Tabela: group_ride_participants (Participantes de Corridas em Grupo)
CREATE TABLE IF NOT EXISTS group_ride_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_ride_id UUID NOT NULL REFERENCES group_rides(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_ride_id, user_id)
);

CREATE INDEX idx_group_ride_participants_group_ride_id ON group_ride_participants(group_ride_id);
CREATE INDEX idx_group_ride_participants_user_id ON group_ride_participants(user_id);

-- RLS para group_ride_participants
ALTER TABLE group_ride_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view participants of their group rides"
  ON group_ride_participants FOR SELECT
  USING (
    auth.uid() = user_id OR
    auth.uid() IN (SELECT organizer_id FROM group_rides WHERE id = group_ride_id)
  );

CREATE POLICY "Users can join group rides"
  ON group_ride_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own participation"
  ON group_ride_participants FOR UPDATE
  USING (auth.uid() = user_id);

-- Tabela: vehicles (Veículos dos Motoristas)
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  color TEXT NOT NULL,
  license_plate TEXT NOT NULL UNIQUE,
  vehicle_type TEXT NOT NULL,
  seats INTEGER NOT NULL DEFAULT 4,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vehicles_driver_id ON vehicles(driver_id);
CREATE INDEX idx_vehicles_license_plate ON vehicles(license_plate);
CREATE INDEX idx_vehicles_is_active ON vehicles(is_active);

-- RLS para vehicles
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can view own vehicles"
  ON vehicles FOR SELECT
  USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can create vehicles"
  ON vehicles FOR INSERT
  WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Drivers can update own vehicles"
  ON vehicles FOR UPDATE
  USING (auth.uid() = driver_id);

-- Tabela: driver_documents (Documentos dos Motoristas)
CREATE TABLE IF NOT EXISTS driver_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES driver_profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('drivers_license', 'vehicle_registration', 'insurance', 'background_check', 'profile_photo', 'vehicle_photo')),
  document_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_driver_documents_driver_id ON driver_documents(driver_id);
CREATE INDEX idx_driver_documents_status ON driver_documents(status);

-- RLS para driver_documents
ALTER TABLE driver_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can view own documents"
  ON driver_documents FOR SELECT
  USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can upload documents"
  ON driver_documents FOR INSERT
  WITH CHECK (auth.uid() = driver_id);

-- Tabela: user_settings (Configurações de Usuário)
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  notification_preferences JSONB DEFAULT '{"push": true, "email": true, "sms": false}'::jsonb,
  privacy_settings JSONB DEFAULT '{"share_location": true, "show_profile": true}'::jsonb,
  language TEXT DEFAULT 'pt-BR',
  theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  accessibility JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

-- RLS para user_settings
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Tabela: ride_recordings (Gravações de Corridas - Segurança)
CREATE TABLE IF NOT EXISTS ride_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  recorded_by UUID NOT NULL REFERENCES profiles(id),
  recording_type TEXT NOT NULL CHECK (recording_type IN ('audio', 'video', 'gps_track')),
  file_url TEXT NOT NULL,
  duration_seconds INTEGER,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'deleted', 'reported')),
  delete_at TIMESTAMPTZ, -- Auto-delete após 7 dias
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ride_recordings_ride_id ON ride_recordings(ride_id);
CREATE INDEX idx_ride_recordings_recorded_by ON ride_recordings(recorded_by);
CREATE INDEX idx_ride_recordings_delete_at ON ride_recordings(delete_at);

-- RLS para ride_recordings
ALTER TABLE ride_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view ride recordings"
  ON ride_recordings FOR SELECT
  USING (
    auth.uid() = recorded_by OR
    auth.uid() IN (SELECT user_id FROM rides WHERE id = ride_id) OR
    auth.uid() IN (SELECT driver_id FROM rides WHERE id = ride_id)
  );

CREATE POLICY "Participants can create recordings"
  ON ride_recordings FOR INSERT
  WITH CHECK (auth.uid() = recorded_by);

-- Tabela: user_streaks (Sequências de Uso)
CREATE TABLE IF NOT EXISTS user_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  total_active_days INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_streaks_user_id ON user_streaks(user_id);

-- RLS para user_streaks
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own streaks"
  ON user_streaks FOR SELECT
  USING (auth.uid() = user_id);

-- Tabela: social_follows (Seguidores no Feed Social)
CREATE TABLE IF NOT EXISTS social_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX idx_social_follows_follower_id ON social_follows(follower_id);
CREATE INDEX idx_social_follows_following_id ON social_follows(following_id);

-- RLS para social_follows
ALTER TABLE social_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view follows"
  ON social_follows FOR SELECT
  USING (true);

CREATE POLICY "Users can follow others"
  ON social_follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow"
  ON social_follows FOR DELETE
  USING (auth.uid() = follower_id);

-- Tabela: user_social_stats (Estatísticas Sociais)
CREATE TABLE IF NOT EXISTS user_social_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  likes_received INTEGER DEFAULT 0,
  comments_received INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_social_stats_user_id ON user_social_stats(user_id);

-- RLS para user_social_stats
ALTER TABLE user_social_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view social stats"
  ON user_social_stats FOR SELECT
  USING (true);



-- =====================================================
-- TRIGGERS para updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers em todas as novas tabelas
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scheduled_rides_updated_at BEFORE UPDATE ON scheduled_rides FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_group_rides_updated_at BEFORE UPDATE ON group_rides FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_driver_documents_updated_at BEFORE UPDATE ON driver_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_streaks_updated_at BEFORE UPDATE ON user_streaks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_social_stats_updated_at BEFORE UPDATE ON user_social_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMENTÁRIOS
-- =====================================================

COMMENT ON TABLE subscriptions IS 'Assinaturas Club Uppi (planos silver, gold, platinum)';
COMMENT ON TABLE scheduled_rides IS 'Corridas agendadas para horários futuros';
COMMENT ON TABLE group_rides IS 'Corridas compartilhadas entre múltiplos passageiros';
COMMENT ON TABLE vehicles IS 'Veículos cadastrados pelos motoristas';
COMMENT ON TABLE driver_documents IS 'Documentos dos motoristas para verificação';
COMMENT ON TABLE user_settings IS 'Configurações personalizadas dos usuários';
COMMENT ON TABLE ride_recordings IS 'Gravações de segurança durante as corridas';
COMMENT ON TABLE user_streaks IS 'Sequências de dias ativos dos usuários';
COMMENT ON TABLE social_follows IS 'Relacionamentos de seguir/seguidor no feed social';
COMMENT ON TABLE user_social_stats IS 'Estatísticas de engajamento social dos usuários';

