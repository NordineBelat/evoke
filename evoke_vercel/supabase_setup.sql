-- ============================================================
-- EVOKE — Script SQL Supabase
-- À exécuter dans Supabase > SQL Editor
-- ============================================================

-- 1. Table users (profils utilisateurs)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'individual' CHECK (account_type IN ('individual','professional')),
  company TEXT,
  siret TEXT,
  phone TEXT,
  plan TEXT NOT NULL DEFAULT 'none' CHECK (plan IN ('none','starter','pro','max')),
  credits INTEGER NOT NULL DEFAULT 0,
  credits_used INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended')),
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Table email_verifications (tokens de validation email)
CREATE TABLE IF NOT EXISTS public.email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Ajouter user_id à la table events (si pas déjà fait)
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 4. Index pour les performances
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON public.events(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON public.email_verifications(token);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user_id ON public.email_verifications(user_id);

-- 5. RLS (Row Level Security) — optionnel mais recommandé
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;

-- Politique : les utilisateurs ne voient que leur propre profil
CREATE POLICY "users_own_profile" ON public.users
  FOR ALL USING (auth.uid() = id);

-- Le service key bypass RLS (utilisé par les fonctions API)
-- Rien à faire, le SERVICE_KEY bypass automatiquement RLS

-- ============================================================
-- VÉRIFICATION
-- ============================================================
SELECT 'Table users créée' as status WHERE EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users');
SELECT 'Table email_verifications créée' as status WHERE EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'email_verifications');
SELECT 'Colonne user_id dans events' as status WHERE EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'user_id');
