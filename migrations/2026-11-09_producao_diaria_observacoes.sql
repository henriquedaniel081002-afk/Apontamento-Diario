-- Migração aditiva da Produção Diária. Não altera apontamentos nem ocorrências existentes.
CREATE TABLE IF NOT EXISTS public.producao_diaria_observacoes (
  data DATE NOT NULL,
  setor TEXT NOT NULL,
  linha TEXT NOT NULL,
  observacao TEXT NOT NULL,
  atualizado_por_id INTEGER NOT NULL REFERENCES public.usuarios(id),
  atualizado_por_login TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT producao_diaria_observacoes_pkey PRIMARY KEY (data, setor, linha),
  CONSTRAINT producao_diaria_observacoes_linha_check CHECK (linha IN ('GERAL', 'MON', 'TRI')),
  CONSTRAINT producao_diaria_observacoes_texto_check CHECK (char_length(observacao) BETWEEN 1 AND 3000)
);
COMMENT ON TABLE public.producao_diaria_observacoes IS 'Observações gerenciais da Produção Diária. Exclusivas da coordenação, desvinculadas das ocorrências dos apontamentos.';
