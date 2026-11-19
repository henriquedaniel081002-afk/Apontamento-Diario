import { useMemo, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { SectionCard } from '../components/common/ui';
import type { ActionFilterStatus } from './acoes';
import { actionSectorOptions, DailyActionSelect } from './DailyActionForm';
import { DAILY_LINES, dailySectorLines, type DailyObservationLine } from './escopo';
import { DailyActionList } from './DailyActionList';

const statusOptions = [
  { value: 'ABERTAS', label: 'Abertas' },
  { value: 'TODAS', label: 'Todas' },
  { value: 'CONCLUIDA', label: 'Concluídas' },
  { value: 'CANCELADA', label: 'Canceladas' },
];
const sectorOptions = [{ value: '', label: 'Todos os setores' }, ...actionSectorOptions];

export function DailyActionPanel({ revision, onChanged }: { revision: number; onChanged: () => void }) {
  const [status, setStatus] = useState<ActionFilterStatus>('ABERTAS');
  const [setor, setSetor] = useState('');
  const [linha, setLinha] = useState<DailyObservationLine | ''>('');
  const filters = useMemo(() => ({ status, setor: setor || undefined, linha: linha || undefined }), [status, setor, linha]);
  const lines = setor ? dailySectorLines(setor) : DAILY_LINES;
  const lineOptions = [
    { value: '', label: 'Todas as linhas' },
    ...lines.map((line) => ({ value: line, label: line === 'GERAL' ? 'Ações gerais do setor' : line })),
  ];

  return (
    <SectionCard title="Acompanhamento de Ações" icon={<ClipboardList className="size-5" aria-hidden="true" />}>
      <div className="daily-action-fields mb-4">
        <DailyActionSelect label="Situação no acompanhamento" value={status} options={statusOptions} onChange={(selected) => setStatus(selected as ActionFilterStatus)} />
        <DailyActionSelect label="Setor no acompanhamento" value={setor} options={sectorOptions} onChange={(selected) => {
            setSetor(selected);
            if (selected && linha && !dailySectorLines(selected).includes(linha)) setLinha('');
          }} />
        <DailyActionSelect label="Linha no acompanhamento" value={linha} options={lineOptions} onChange={(selected) => setLinha(selected as DailyObservationLine | '')} />
      </div>
      <DailyActionList key={JSON.stringify([filters, revision])} filters={filters} onChanged={onChanged} />
    </SectionCard>
  );
}
