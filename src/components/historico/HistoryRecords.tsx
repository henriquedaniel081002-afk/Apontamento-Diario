import { Apontamento } from '../../types';
import { CoordinationRecords } from '../coordenacao/CoordinationRecords';

interface HistoryRecordsProps {
  records: Apontamento[];
  onView: (record: Apontamento) => void;
  onEdit: (record: Apontamento) => void;
  onDelete: (record: Apontamento) => void;
}

/**
 * O histórico operacional usa exatamente o mesmo padrão visual de cards da
 * Coordenação. Assim, qualquer evolução do card da Coordenação também mantém
 * o histórico dos setores consistente, sem duplicar markup e estilos.
 */
export function HistoryRecords(props: HistoryRecordsProps) {
  return <CoordinationRecords {...props} ariaLabel="Registros encontrados no histórico da unidade" />;
}
