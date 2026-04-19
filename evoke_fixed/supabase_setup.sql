-- ============================================================
-- EVOKE — Script SQL Supabase (version corrigée — snake_case)
-- À exécuter dans Supabase > SQL Editor
-- ============================================================

-- 1. Table users (profils utilisateurs)
CREATE TABLE IF NOT EXISTS public.users (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL UNIQUE,
  first_name   TEXT NOT NULL,
  last_name    TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'individual' CHECK (account_type IN ('individual','professional')),
  company      TEXT,
  siret        TEXT,
  phone        TEXT,
  plan         TEXT NOT NULL DEFAULT 'none' CHECK (plan IN ('none','starter','pro','max')),
  credits      INTEGER NOT NULL DEFAULT 0,
  credits_used INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended')),
  last_login   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Table events (événements mariage)
CREATE TABLE IF NOT EXISTS public.events (
  id           TEXT PRIMARY KEY,
  couple       TEXT NOT NULL DEFAULT '',
  p1           TEXT NOT NULL DEFAULT '',
  p2           TEXT NOT NULL DEFAULT '',
  date         TEXT,
  guests       INTEGER NOT NULL DEFAULT 0,
  credits      INTEGER NOT NULL DEFAULT 0,
  used_credits INTEGER NOT NULL DEFAULT 0,
  email        TEXT,
  token        TEXT,
  songs        JSONB NOT NULL DEFAULT '[]',
  quiz         JSONB NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id      UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- 3. Table email_verifications (tokens de validation email)
CREATE TABLE IF NOT EXISTS public.email_verifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Index pour les performances
CREATE INDEX IF NOT EXISTS idx_users_email                  ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_status                 ON public.users(status);
CREATE INDEX IF NOT EXISTS idx_events_user_id               ON public.events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at            ON public.events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_verifications_token    ON public.email_verifications(token);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user_id  ON public.email_verifications(user_id);

-- 5. RLS (Row Level Security)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;

-- Politique : les utilisateurs ne voient que leur propre profil
CREATE POLICY "users_own_profile" ON public.users
  FOR ALL USING (auth.uid() = id);

-- Note : le SERVICE_KEY bypass RLS automatiquement (utilisé par les fonctions API)

-- ============================================================
-- VÉRIFICATION
-- ============================================================
SELECT 'Table users OK'               AS status WHERE EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users');
SELECT 'Table events OK'              AS status WHERE EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'events');
SELECT 'Table email_verifications OK' AS status WHERE EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'email_verifications');
SELECT 'Colonne used_credits OK'      AS status WHERE EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'used_credits');
SELECT 'Colonne created_at OK'        AS status WHERE EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'created_at');
