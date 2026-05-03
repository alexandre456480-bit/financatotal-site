-- Execute este script no SQL Editor do Supabase para criar a estrutura necessária.

CREATE TABLE IF NOT EXISTS public.app_data (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  key text NOT NULL,
  value jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, key)
);

-- Permissões básicas se RLS estiver ligado (opcional, o backend usa service_role para pular RLS, então não é estritamente necessário)
ALTER TABLE public.app_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role all access on app_data" ON public.app_data
  AS PERMISSIVE FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
