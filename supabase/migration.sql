-- 1. Criar a tabela de torneios se ela não existir
CREATE TABLE IF NOT EXISTS public.tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'FINALIZADO')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Realtime para a tabela tournaments
ALTER PUBLICATION supabase_realtime ADD TABLE tournaments;

-- 2. Adicionar tournament_id como FK em teams e matches (inicialmente nullable)
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE;

-- 3. Criar torneio "Legado" e associar registros órfãos existentes
DO $$
DECLARE
    legacy_id UUID;
    has_data BOOLEAN;
BEGIN
    SELECT EXISTS (SELECT 1 FROM public.teams) OR EXISTS (SELECT 1 FROM public.matches) INTO has_data;
    
    IF has_data THEN
        -- Criar torneio Legado
        INSERT INTO public.tournaments (name, status) 
        VALUES ('Torneio Legado', 'ATIVO') 
        RETURNING id INTO legacy_id;
        
        -- Vincular registros existentes
        UPDATE public.teams SET tournament_id = legacy_id WHERE tournament_id IS NULL;
        UPDATE public.matches SET tournament_id = legacy_id WHERE tournament_id IS NULL;
    END IF;
-- 4. Criar tabela de perfis para Super Admins se não existir
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Adicionar colunas de redes sociais e privacidade à tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tiktok TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_phone BOOLEAN DEFAULT TRUE;

-- 5. Adicionar colunas adicionais na tabela tournaments
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS sport_type TEXT DEFAULT 'DOMINO';
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS max_teams INTEGER DEFAULT 16;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS entry_fee NUMERIC DEFAULT 100.00;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS end_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS rules TEXT;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS format TEXT;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS organizer_pix_key TEXT;

-- 6. Configuração do bucket de Storage 'covers' para fotos de capa
INSERT INTO storage.buckets (id, name, public) 
VALUES ('covers', 'covers', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso para o bucket 'covers'
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Permitir leitura pública das capas'
    ) THEN
        CREATE POLICY "Permitir leitura pública das capas" 
        ON storage.objects FOR SELECT 
        USING (bucket_id = 'covers');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Permitir upload de capas'
    ) THEN
        CREATE POLICY "Permitir upload de capas" 
        ON storage.objects FOR INSERT 
        WITH CHECK (bucket_id = 'covers');
    END IF;
END $$;

-- 7. Adicionar colunas de gestão de inscrições e pagamentos na tabela teams
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'PENDING';
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS manager_name TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Amador A';
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS roster JSONB;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS contact TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 8. Configuração do bucket de Storage 'receipts' para comprovantes de pagamento Pix
INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso para o bucket 'receipts'
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Permitir leitura pública dos comprovantes'
    ) THEN
        CREATE POLICY "Permitir leitura pública dos comprovantes" 
        ON storage.objects FOR SELECT 
        USING (bucket_id = 'receipts');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Permitir upload de comprovantes'
    ) THEN
        CREATE POLICY "Permitir upload de comprovantes" 
        ON storage.objects FOR INSERT 
        WITH CHECK (bucket_id = 'receipts');
    END IF;
END $$;

-- 9. Permitir status 'CANCELADO' e 'EM_ANDAMENTO' na tabela tournaments
ALTER TABLE public.tournaments DROP CONSTRAINT IF EXISTS tournaments_status_check;
ALTER TABLE public.tournaments ADD CONSTRAINT tournaments_status_check CHECK (status IN ('ATIVO', 'FINALIZADO', 'CANCELADO', 'EM_ANDAMENTO'));

-- 10. Suporte a Webhooks do Mercado Pago e Cancelamento/Estorno
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS mp_payment_id TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS cancellation_status TEXT;

-- 11. Políticas de Storage para o Bucket 'covers'
INSERT INTO storage.buckets (id, name, public) 
VALUES ('covers', 'covers', true) 
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Permitir leitura pública das capas'
    ) THEN
        CREATE POLICY "Permitir leitura pública das capas" 
        ON storage.objects FOR SELECT 
        USING (bucket_id = 'covers');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Permitir upload de capas'
    ) THEN
        CREATE POLICY "Permitir upload de capas" 
        ON storage.objects FOR INSERT 
        WITH CHECK (bucket_id = 'covers');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Permitir update de capas'
    ) THEN
        CREATE POLICY "Permitir update de capas" 
        ON storage.objects FOR UPDATE 
        USING (bucket_id = 'covers');
    END IF;
END $$;

-- 12. Tabela de Gestão de Equipe e RBAC (Compartilhamento de Torneio)
CREATE TABLE IF NOT EXISTS public.tournament_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'REFEREE', 'SCOREKEEPER')),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(tournament_id, email)
);

ALTER TABLE public.tournament_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura de tournament_staff para autenticados" 
ON public.tournament_staff FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir insert/update/delete de tournament_staff para autenticados" 
ON public.tournament_staff FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- 13. Habilitar leitura pública para a tabela profiles (Perfil Público do Atleta)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Permitir leitura pública de perfis'
    ) THEN
        CREATE POLICY "Permitir leitura pública de perfis" 
        ON public.profiles FOR SELECT 
        USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Permitir que usuários atualizem seu próprio perfil'
    ) THEN
        CREATE POLICY "Permitir que usuários atualizem seu próprio perfil" 
        ON public.profiles FOR UPDATE 
        TO authenticated 
        USING (auth.uid() = id)
        WITH CHECK (auth.uid() = id);
    END IF;
END $$;

-- 14. Suporte a Categoria de Gênero (MASCULINO, FEMININO, MISTO) em tournaments
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS gender_category TEXT DEFAULT 'MISTO';
ALTER TABLE public.tournaments DROP CONSTRAINT IF EXISTS tournaments_gender_category_check;
ALTER TABLE public.tournaments ADD CONSTRAINT tournaments_gender_category_check CHECK (gender_category IN ('MASCULINO', 'FEMININO', 'MISTO'));

-- 15. Tabela de Membros de Equipe (team_members) para vínculo automático de atletas
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT,
    email TEXT,
    is_captain BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'team_members' AND policyname = 'Permitir leitura pública de team_members'
    ) THEN
        CREATE POLICY "Permitir leitura pública de team_members" 
        ON public.team_members FOR SELECT 
        USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'team_members' AND policyname = 'Permitir insert/update de team_members para autenticados'
    ) THEN
        CREATE POLICY "Permitir insert/update de team_members para autenticados" 
        ON public.team_members FOR ALL 
        TO authenticated 
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;

-- 16. Suporte a Patrocinadores (coluna sponsors JSONB e bucket sponsors)
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS sponsors JSONB DEFAULT '[]'::jsonb;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('sponsors', 'sponsors', true) 
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Permitir leitura pública das logos de patrocinadores'
    ) THEN
        CREATE POLICY "Permitir leitura pública das logos de patrocinadores" 
        ON storage.objects FOR SELECT 
        USING (bucket_id = 'sponsors');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Permitir upload de logos de patrocinadores'
    ) THEN
        CREATE POLICY "Permitir upload de logos de patrocinadores" 
        ON storage.objects FOR INSERT 
        WITH CHECK (bucket_id = 'sponsors');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Permitir update de logos de patrocinadores'
    ) THEN
        CREATE POLICY "Permitir update de logos de patrocinadores" 
        ON storage.objects FOR UPDATE 
        USING (bucket_id = 'sponsors');
    END IF;
END $$;

-- 17. Automação de Split de Pagamento Pix (Taxa 10% Plataforma / 90% Organizador)
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS payout_status TEXT DEFAULT 'PENDING';
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS payout_amount NUMERIC;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS payout_error TEXT;

-- 18. Suporte a Horário do Torneio (start_time)
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS start_time TEXT;

-- 19. Suporte a Chaveamento Mata-Mata Eliminatório (round, next_match_id, team1_id, team2_id, winner_id)
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS round INTEGER DEFAULT 1;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS next_match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS team1_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS team2_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS match_order INTEGER;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS winner_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

-- Políticas de RLS para a tabela matches
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'matches' AND policyname = 'Permitir leitura pública de partidas'
    ) THEN
        CREATE POLICY "Permitir leitura pública de partidas"
        ON public.matches FOR SELECT
        USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'matches' AND policyname = 'Permitir escrita de partidas para organizadores autenticados'
    ) THEN
        CREATE POLICY "Permitir escrita de partidas para organizadores autenticados"
        ON public.matches FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;

-- 20. Suporte a Histórico Detalhado da Partida (set_history, sets_history, history, details, detailed_score, penalties_a, penalties_b)
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS set_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS sets_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS detailed_score JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS penalties_a INTEGER DEFAULT 0;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS penalties_b INTEGER DEFAULT 0;




