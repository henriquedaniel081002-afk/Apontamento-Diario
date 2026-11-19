import { useMemo, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { Field, SectionCard } from '../components/common/ui';
import type { ActionFilterStatus } from './acoes';
import { DAILY_LINES, DAILY_SECTORS, dailySectorLines, type DailyObservationLine } from './escopo';
import { DailyActionList } from './DailyActionList';

export function DailyActionPanel({ revision, onChanged }: { revision: number; onChanged: () => void }) {
  const [status, setStatus] = useState<ActionFilterStatus>('ABERTAS');
  const [setor, setSetor] = useState('');
  const [linha, setLinha] = useState<DailyObservationLine | ''>('');
  const filters = useMemo(() => ({ status, setor: setor || undefined, linha: linha || undefined }), [status, setor, linha]);
  const lines = setor ? dailySectorLines(setor) : DAILY_LINES;

  return (
    <SectionCard title="Acompanhamento de Ações" icon={<ClipboardList className="size-5" aria-hidden="true" />}>
      <div className="daily-action-fields mb-4">
        <Field label="Situação no acompanhamento">
          <select className="field-control" value={status} onChange={(event) => setStatus(event.target.value as ActionFilterStatus)}>
            <option value="ABERTAS">Abertas</option>
            <option value="TODAS">Todas</option>
            <option value="CONCLUIDA">Concluídas</option>
            <option value="CANCELADA">Canceladas</option>
          </select>
        </Field>
        <Field label="Setor no acompanhamento">
          <select className="field-control" value={setor} onChange={(event) => {
            const selected = event.target.value;
            setSetor(selected);
            if (selected && linha && !dailySectorLines(selected).includes(linha)) setLinha('');
          }}>
            <option value="">Todos os setores</option>
            {DAILY_SECTORS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="Linha no acompanhamento">
          <select className="field-control" value={linha} onChange={(event) => setLinha(event.target.value as DailyObservationLine | '')}>
            <option value="">Todas as linhas</option>
            {lines.map((item) => <option key={item} value={item}>{item === 'GERAL' ? 'Ações gerais do setor' : item}</option>)}
          </select>
        </Field>
      </div>
      <DailyActionList key={JSON.stringify([filters, revision])} filters={filters} onChanged={onChanged} />
    </SectionCard>
  );
}
