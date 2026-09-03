export type AtrasoStatus = 'ATRASO' | 'ADIANTAMENTO';

export interface AtrasoRecord {
  serie: number;
  potencia: number | null;
  linha: string;
  op: number | null;
  cliente: string;
  data_programada: string;
  setor: string;
  status: AtrasoStatus;
}

export interface AtrasoImportPreview {
  fileName: string;
  totalSourceRows: number;
  atrasoRows: number;
  adiantamentoRows: number;
  ignoredRows: number;
  payload: AtrasoRecord[];
}
