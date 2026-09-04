import type {
  DailyProductionMetrics,
  DailyProductionSectorRow,
} from './types';

export function calculateAdherence(programado: number, produzido: number): number | null {
  return programado > 0 ? (produzido / programado) * 100 : null;
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
