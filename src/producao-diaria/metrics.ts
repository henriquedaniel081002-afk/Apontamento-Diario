import type {
  DailyProductionMetrics,
  DailyProductionSectorRow,
} from './types';

export function calculateAdherence(programado: number, produzido: number): number | null {
  return programado > 0 ? (produzido / programado) * 100 : null;
}

/** Uma linha com meta não atingida mantém o setor pendente, mesmo com excedente em outra linha. */
export function isBelowDailyProgramming(row: DailyProductionSectorRow): boolean {
  if (row.linhas?.length) {
    return row.linhas.some((line) => line.programado > 0 && line.produzido < line.programado);
  }
  // Compatibilidade com respostas antigas sem detalhamento por linha.
  return row.programado > 0 && row.produzido < row.programado;
}

export function buildDailyProductionMetrics(rows: DailyProductionSectorRow[]): DailyProductionMetrics {
  const setores = rows.map((row) => ({
    ...row,
    aderencia: calculateAdherence(row.programado, row.produzido),
  }));
  const programado = setores.reduce((total, row) => total + row.programado, 0);
  const produzido = setores.reduce((total, row) => total + row.produzido, 0);

  return {
    setores,
    totais: {
      programado,
      produzido,
      aderencia: calculateAdherence(programado, produzido),
    },
  };
}
