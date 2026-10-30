-- ITAM | Gestão de Atrasos por OP — executar SOMENTE no Supabase do controle de atrasos.
-- Novas tabelas independentes; não modifica controle_atrasos nem dados atuais.
-- A autenticação e as permissões continuam no Neon, validadas pelo backend.
BEGIN;
CREATE TABLE IF NOT EXISTS public.atrasos_importacoes (
  id UUID PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('PROGRAMACAO','APONTAMENTO')),
  status TEXT NOT NULL CHECK (status IN ('PENDENTE','ATIVA')),
  esperado INTEGER NOT NULL CHECK (esperado > 0),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS atrasos_importacoes_ativa_tipo
  ON public.atrasos_importacoes (tipo) WHERE status = 'ATIVA';
CREATE UNIQUE INDEX IF NOT EXISTS atrasos_importacoes_pendente_tipo
  ON public.atrasos_importacoes (tipo) WHERE status = 'PENDENTE';

CREATE TABLE IF NOT EXISTS public.atrasos_programacao_detalhada (
  importacao_id UUID NOT NULL REFERENCES public.atrasos_importacoes(id) ON DELETE CASCADE,
  serie TEXT NOT NULL,
  setor TEXT NOT NULL,
  op TEXT NOT NULL,
  data_programada DATE NOT NULL,
  linha TEXT NOT NULL,
  cliente TEXT,
  potencia TEXT,
  referencia TEXT,
  PRIMARY KEY (importacao_id, serie, setor, op)
);
CREATE INDEX IF NOT EXISTS atrasos_prog_serie_setor ON public.atrasos_programacao_detalhada (importacao_id, serie, setor);
CREATE INDEX IF NOT EXISTS atrasos_prog_op_setor ON public.atrasos_programacao_detalhada (importacao_id, op, setor);
CREATE INDEX IF NOT EXISTS atrasos_prog_data ON public.atrasos_programacao_detalhada (importacao_id, data_programada);

CREATE TABLE IF NOT EXISTS public.atrasos_apontamentos_detalhados (
  importacao_id UUID NOT NULL REFERENCES public.atrasos_importacoes(id) ON DELETE CASCADE,
  serie TEXT NOT NULL,
  setor TEXT NOT NULL,
  op TEXT NOT NULL,
  data_produzida DATE NOT NULL,
  linha TEXT,
  potencia TEXT,
  turno TEXT,
  codigo_produto TEXT,
  PRIMARY KEY (importacao_id, serie, setor, op)
);
CREATE INDEX IF NOT EXISTS atrasos_apon_serie_setor ON public.atrasos_apontamentos_detalhados (importacao_id, serie, setor);
CREATE INDEX IF NOT EXISTS atrasos_apon_op_setor ON public.atrasos_apontamentos_detalhados (importacao_id, op, setor);
CREATE INDEX IF NOT EXISTS atrasos_apon_data ON public.atrasos_apontamentos_detalhados (importacao_id, data_produzida);

-- Não criar FK para public.usuarios: os usuários são mantidos no banco Neon.
-- login preservado como fotografia do autor da justificativa no momento da gravação.
CREATE TABLE IF NOT EXISTS public.atrasos_justificativas (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  op TEXT NOT NULL,
  setor TEXT NOT NULL,
  motivo TEXT NOT NULL,
  previsao_regularizacao DATE,
  usuario_id INTEGER NOT NULL,
  usuario_login TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS atrasos_justificativas_op_setor_em
  ON public.atrasos_justificativas (op, setor, criado_em DESC, id DESC);

-- As novas tabelas não são utilizadas diretamente pelo navegador (REST/anon).
-- O backend comunica-se via PostgreSQL usando ATRASO_DATABASE_URL.
-- Habilitar RLS em public impede acessos indevidos pela Data API.
ALTER TABLE public.atrasos_importacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atrasos_programacao_detalhada ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atrasos_apontamentos_detalhados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atrasos_justificativas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.atrasos_importacoes FROM anon, authenticated;
REVOKE ALL ON TABLE public.atrasos_programacao_detalhada FROM anon, authenticated;
REVOKE ALL ON TABLE public.atrasos_apontamentos_detalhados FROM anon, authenticated;
REVOKE ALL ON TABLE public.atrasos_justificativas FROM anon, authenticated;
COMMIT;
