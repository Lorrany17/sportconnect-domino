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
END $$;
