export interface DailyProductionSectorRow {
  setor: string;
  programado: number;
  produzido: number;
}

export interface DailyProductionResponse {
  geradoEm: string;
  filtros: { linhas: string[] };
  setores: DailyProductionSectorRow[];
}

export interface DailyProductionSectorMetric extends DailyProductionSectorRow {
  aderencia: number | null;
}

export interface DailyProductionMetrics {
  setores: DailyProductionSectorMetric[];
  totais: {
    programado: number;
    produzido: number;
    aderencia: number | null;
  };
}
