import type {
  DetalheFalta,
  DetalheObservacao,
  DetalheProducao,
  Falta,
  FaltaMaterial,
  MaquinaQuebrada,
  NaoConformidade,
  Observacao,
} from './components/DayDetailModal';

export type DashboardProgramacao = { data: string; linha: string; setor: string; quantidade: number };
export type DashboardApontamento = DashboardProgramacao & { turno: string };

export interface DashboardData {
  geradoEm: string;
  periodo: { meses: string[] };
  filtros: { linhas: string[]; setores: string[]; turnos: string[] };
  programacao: DashboardProgramacao[];
  apontamento: DashboardApontamento[];
  detalhesProducao: DetalheProducao[];
  faltas: Falta[];
  observacoes: Observacao[];
  detalhesFaltas: DetalheFalta[];
  detalhesObservacoes: DetalheObservacao[];
  faltasMaterial: FaltaMaterial[];
  maquinasQuebradas: MaquinaQuebrada[];
  naoConformidades: NaoConformidade[];
}
