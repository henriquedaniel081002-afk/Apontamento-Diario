import React from 'react';
import { AlertTriangle, Boxes, Clock, MessageSquareText, Settings, UserRound, UserX, Zap } from 'lucide-react';
import { Apontamento, FaltaItem } from '../../types';
import { formatDateBR, formatPotencia } from '../../utils/formatters';
import { getApontamentoTotals, getOperationalUnitLabel } from '../../utils/operational';
import { ModalShell } from '../common/ModalShell';
import { Badge, Surface } from '../common/ui';

interface Props {
  apontamento: Apontamento | null;
  isOpen: boolean;
  onClose: () => void;
}

const legacyFalta = (item: FaltaItem) => !item.nome && Boolean(item.linha || item.turno || item.quantidade || item.justificativa);

function Block({ title, icon, count, children }: { title: string; icon: React.ReactNode; count: number; children: React.ReactNode }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10">
      <div className="flex min-w-0 items-center gap-2 border-b border-white/10 bg-white/[0.025] px-3 py-3 min-[420px]:px-4">
        <span className="shrink-0 text-slate-400">{icon}</span>
        <h3 className="min-w-0 flex-1 break-words text-sm font-black text-slate-100 [overflow-wrap:anywhere]">{title}</h3>
        <Badge variant={count ? 'success' : 'neutral'}>{count}</Badge>
      </div>
      <div className="min-w-0 p-3 min-[420px]:p-4">{children}</div>
    </section>
  );
}

const Empty = ({ text }: { text: string }) => <p className="text-sm text-slate-500">{text}</p>;
const textWrapClass = 'break-words [overflow-wrap:anywhere]';

export const DetailModal: React.FC<Props> = ({ apontamento, isOpen, onClose }) => {
  if (!apontamento) return null;

  const totals = getApontamentoTotals(apontamento);
  const updatedAt = new Date(apontamento.updatedAt);
  const formattedUpdate = Number.isNaN(updatedAt.getTime())
    ? 'Horário não informado'
    : updatedAt.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  const material = apontamento.paradasFaltaMaterial || [];
  const maquina = apontamento.paradasMaquina || [];
  const nc = apontamento.naoConformidades || [];

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={`Detalhes • ${formatDateBR(apontamento.data)}`}
      description={`${getOperationalUnitLabel(apontamento)} • ${apontamento.userName}`}
      size="xl"
      className="detail-modal-responsive"
    >
      <div className="min-w-0 space-y-4">
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
          <Surface tone="muted" padding="sm" className="min-w-0">
            <p className="text-[10px] font-black uppercase text-slate-500">Produção</p>
            <p className="mt-1 text-xl font-black text-slate-100">{totals.producao}</p>
          </Surface>
          <Surface tone="muted" padding="sm" className="min-w-0">
            <p className="text-[10px] font-black uppercase text-slate-500">Ocorrências</p>
            <p className="mt-1 text-xl font-black text-slate-100">{material.length + maquina.length + nc.length + apontamento.faltas.length + apontamento.observacoes.length}</p>
          </Surface>
          <Surface tone="muted" padding="sm" className="min-w-0">
            <p className="text-[10px] font-black uppercase text-slate-500">Status</p>
            <p className={`mt-1 text-sm font-black text-slate-100 ${textWrapClass}`}>{apontamento.statusAprovacao || 'PENDENTE'}</p>
          </Surface>
          <Surface tone="muted" padding="sm" className="min-w-0">
            <p className="text-[10px] font-black uppercase text-slate-500">Atualizado</p>
            <p className={`mt-1 text-xs font-bold text-slate-200 ${textWrapClass}`}>{formattedUpdate}</p>
          </Surface>
        </div>

        <Block title="Produção" icon={<Zap className="h-4 w-4" />} count={apontamento.producoes.length}>
          {apontamento.producoes.length ? (
            <div className="space-y-2">
              {apontamento.producoes.map((item) => (
                <div key={item.id} className="flex min-w-0 flex-col gap-1 rounded-xl bg-white/[0.035] px-3 py-2 min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between min-[380px]:gap-3">
                  <span className={`min-w-0 text-sm text-slate-200 ${textWrapClass}`}>{item.linha} · {item.potenciaFormatted || formatPotencia(item.potencia)} kVA</span>
                  <strong className="shrink-0 text-sm text-emerald-300">{item.quantidade} unid.</strong>
                </div>
              ))}
            </div>
          ) : <Empty text="Sem produção registrada." />}
        </Block>

        <Block title="Parada por Falta de Material" icon={<Boxes className="h-4 w-4" />} count={material.length}>
          {material.length ? (
            <div className="space-y-2">
              {material.map((item) => (
                <div key={item.id} className="min-w-0 rounded-xl bg-white/[0.035] p-3">
                  <strong className={`text-sm text-slate-100 ${textWrapClass}`}>{item.material || 'Material não informado'}</strong>
                  <p className={`mt-1 text-sm text-slate-300 ${textWrapClass}`}>{item.causaMotivo || 'Motivo não informado'}</p>
                  <p className={`mt-1 text-xs text-slate-500 ${textWrapClass}`}>{item.horaInicio || 'Início não informado'} → {item.horaFim || 'Em andamento'}</p>
                </div>
              ))}
            </div>
          ) : <Empty text="Nenhuma ocorrência." />}
        </Block>

        <Block title="Parada por Máquina Quebrada" icon={<Settings className="h-4 w-4" />} count={maquina.length}>
          {maquina.length ? (
            <div className="space-y-2">
              {maquina.map((item) => (
                <div key={item.id} className="min-w-0 rounded-xl bg-white/[0.035] p-3">
                  <strong className={`text-sm text-slate-100 ${textWrapClass}`}>{item.maquinaEquipamento || 'Máquina não informada'}</strong>
                  <p className={`mt-1 text-sm text-slate-300 ${textWrapClass}`}>{item.observacao || 'Observação não informada'}</p>
                  <p className={`mt-1 text-xs text-slate-500 ${textWrapClass}`}>{item.horaInicio || 'Início não informado'} → {item.horaFim || 'Em andamento'}</p>
                </div>
              ))}
            </div>
          ) : <Empty text="Nenhuma ocorrência." />}
        </Block>

        <Block title="Não Conformidade" icon={<AlertTriangle className="h-4 w-4" />} count={nc.length}>
          {nc.length ? (
            <div className="space-y-2">
              {nc.map((item) => (
                <div key={item.id} className="min-w-0 rounded-xl bg-white/[0.035] p-3">
                  <strong className={`text-sm text-slate-100 ${textWrapClass}`}>OP {item.op || 'não informada'} · Série {item.numeroSerie || 'não informada'}</strong>
                  <p className={`mt-1 text-sm text-slate-300 ${textWrapClass}`}>{item.causaNaoConformidade || 'Causa não informada'}</p>
                </div>
              ))}
            </div>
          ) : <Empty text="Nenhuma ocorrência." />}
        </Block>

        <Block title="Faltas" icon={<UserX className="h-4 w-4" />} count={apontamento.faltas.length}>
          {apontamento.faltas.length ? (
            <div className="space-y-2">
              {apontamento.faltas.map((item) => (
                <div key={item.id} className="min-w-0 rounded-xl bg-white/[0.035] p-3">
                  {legacyFalta(item) ? (
                    <>
                      <strong className={`text-sm text-slate-100 ${textWrapClass}`}>{item.linha || 'Linha não informada'} · {item.turno || 'Turno não informado'}</strong>
                      <p className={`mt-1 text-sm text-slate-300 ${textWrapClass}`}>Quantidade: {item.quantidade ?? 0}{item.justificativa ? ` · ${item.justificativa}` : ''}</p>
                    </>
                  ) : (
                    <>
                      <strong className={`text-sm text-slate-100 ${textWrapClass}`}>{item.nome || 'Nome não informado'}</strong>
                      <p className={`mt-1 text-sm text-slate-300 ${textWrapClass}`}>{item.motivoJustificativa || 'Motivo não informado'}</p>
                      <p className="mt-1 text-xs text-slate-500">Atestado: {typeof item.atestado === 'boolean' ? (item.atestado ? 'Sim' : 'Não') : 'Não informado'}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : <Empty text="Nenhuma falta." />}
        </Block>

        <Block title="Observações" icon={<MessageSquareText className="h-4 w-4" />} count={apontamento.observacoes.length}>
          {apontamento.observacoes.length ? (
            <div className="space-y-2">
              {apontamento.observacoes.map((item) => (
                <div key={item.id} className="min-w-0 rounded-xl bg-white/[0.035] p-3">
                  {(item.linha || item.turno) && <p className={`text-xs font-bold text-slate-500 ${textWrapClass}`}>{item.linha || 'Linha não informada'} · {item.turno || 'Turno não informado'}</p>}
                  <p className={`mt-1 whitespace-pre-wrap text-sm text-slate-200 ${textWrapClass}`}>{item.observacao || 'Observação não informada'}</p>
                  {item.justificativaMeta && <p className={`mt-2 text-sm text-slate-400 ${textWrapClass}`}><strong className="text-slate-200">Justificativa da meta:</strong> {item.justificativaMeta}</p>}
                </div>
              ))}
            </div>
          ) : <Empty text="Nenhuma observação." />}
        </Block>

        <div className="grid gap-3 sm:grid-cols-2">
          <Surface tone="inset" padding="sm" className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500"><UserRound className="h-4 w-4 shrink-0" />Responsável</p>
            <p className={`mt-2 text-sm font-bold text-slate-100 ${textWrapClass}`}>{apontamento.userName}</p>
          </Surface>
          <Surface tone="inset" padding="sm" className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500"><Clock className="h-4 w-4 shrink-0" />Última atualização</p>
            <p className={`mt-2 text-sm font-bold text-slate-100 ${textWrapClass}`}>{formattedUpdate}</p>
          </Surface>
        </div>
      </div>
    </ModalShell>
  );
};
