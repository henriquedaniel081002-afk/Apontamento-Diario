export interface AderenciaAnualRecord {
  id?: number | string;
  mes: string;
  programado: number | null;
  realizado: number | null;
  dias_uteis: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AderenciaAnualUpsertRow {
  mes: string;
  programado: number;
  realizado: number;
  dias_uteis: number;
}

export interface AderenciaAnualMetrics {
  averageWorkdays: number | null;
  adherence: number | null;
  totalProduced: number;
  monthCount: number;
  adherenceMonthCount: number;
}

export interface AderenciaAnualImportPreview {
  payload: AderenciaAnualUpsertRow[];
  years: number[];
  firstMonth: string;
  lastMonth: string;
}

export interface AnnualComparisonRow {
  month: string;
  monthNumber: number;
  [year: string]: string | number | null;
}
