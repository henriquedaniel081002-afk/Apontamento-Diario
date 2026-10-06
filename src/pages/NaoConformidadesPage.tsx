import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, ClipboardCheck, Clock3, Percent, RefreshCw, Search } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CustomSelect } from '../components/common/CustomSelect';
import { ModalShell } from '../components/common/ModalShell';
import { Toast, type ToastMessage } from '../components/common/Toast';
import {
  Badge, Button, DataTable, DateInput, EmptyState, ErrorState, Field, FieldError,
  FilterPanel, Input, LoadingState, MetricCard, PageContainer, PageHeader, SectionCard, Surface,
} from '../components/common/ui';
import { ApiError } from '../services/apiClient';
import { naoConformidadesService } from '../services/naoConformidadesService';
import type { NaoConformidadeDashboardItem, NaoConformidadesFiltros, NaoConformidadesResponse } from '../types/naoConformidades';
import { formatDateBR } from '../utils/formatters';
import { formatLocalYmd } from '../utils/operational';
import { calcularIndicadoresNC, tempoNaoConformidade } from '../utils/naoConformidades';

const statusOptions = [
  { value: 'ALL', label: 'Todos' },
  { value: 'AGUARDANDO_REPARO', label: 'Aguardando reparo' },
  { value: 'REPARADO', label: 'Reparado' },
];
const tooltipStyle = { background: 'var(--surface-overlay)', border: '1px solid var(--border-strong)', borderRadius: 12, color: 'var(--text-primary)' };
const number = (value: number) => value.toLocaleString('pt-BR');
const dateTime = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('pt-BR') : '—';

function initialFilters(): NaoConformidadesFiltros {
  const today = new Date();
  return {
    dataInicio: formatLocalYmd(new Date(today.getFullYear(), today.getMonth(), 1)),
    dataFim: formatLocalYmd(today), setorId: '', status: 'ALL', busca: '',
  };
}

function ReparoBadge({ item }: { item: NaoConformidadeDashboardItem }) {
  return <Badge variant={item.statusReparo === 'REPARADO' ? 'success' : 'warning'}>
    {item.statusReparo === 'REPARADO' ? 'Reparado' : 'Aguardando reparo'}
  </Badge>;
}

function ReadonlyValue({ label, value, className = '' }: { label: string; value?: string; className?: string }) {
  return <div className={`min-w-0 ${className}`}><dt className="text-xs font-bold text-slate-400">{label}</dt>
    <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-100 [overflow-wrap:anywhere]">{value || '—'}</dd></div>;
}

export function NaoConformidadesPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [applied, setApplied] = useState(filters);
  const [data, setData] = useState<NaoConformidadesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<NaoConformidadeDashboardItem | null>(null);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const saveInFlight = useRef(false);
  const invalidPeriod = !filters.dataInicio || !filters.dataFim || filters.dataInicio > filters.dataFim;
  const canRepair = selected?.statusReparo === 'AGUARDANDO_REPARO';

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void naoConformidadesService.listar(applied)
      .then((result) => { if (active) setData(result); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Falha ao carregar as Não Conformidades.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applied, refresh]);

  const metrics = useMemo(() => calcularIndicadoresNC(data?.registros || []), [data]);
  const statusData = [
    { name: 'Aguardando reparo', value: metrics.aguardando, color: 'var(--warning)' },
    { name: 'Reparado', value: metrics.reparadas, color: 'var(--success)' },
  ];
  const setorOptions = [{ value: '', label: 'Todos os setores disponíveis' }, ...(data?.setores || []).map((s) => ({ value: s.id, label: s.nome }))];

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    if (!invalidPeriod) setApplied({ ...filters, busca: filters.busca.trim() });
  };
  const openRecord = (item: NaoConformidadeDashboardItem) => {
    setDescription(''); setSaveError(''); setSelected(item);
  };
  const closeRecord = () => { if (!saveInFlight.current) setSelected(null); };

  const confirmRepair = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !canRepair || saveInFlight.current) return;
    if (!description.trim()) {
      setSaveError('Descreva como a Não Conformidade foi reparada.');
      descriptionRef.current?.focus();
      return;
    }
    saveInFlight.current = true;
    setSaving(true); setSaveError('');
    try {
      const updated = await naoConformidadesService.reparar(selected.id, description.trim());
      setData((current) => current ? {
        ...current,
        registros: current.registros.map((item) => item.id === updated.id ? updated : item)
          .filter((item) => applied.status === 'ALL' || item.statusReparo === applied.status),
      } : current);
      setSelected(null);
      setToast({ id: String(Date.now()), type: 'success', message: 'Reparo registrado com sucesso.' });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Não foi possível registrar o reparo.';
      if (reason instanceof ApiError && (reason.status === 409 || reason.status === 404 || reason.status === 403)) {
        setSelected(null);
        setToast({ id: String(Date.now()), type: 'error', message });
        setRefresh((value) => value + 1);
      } else {
        setSaveError(message);
      }
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  };

  const action = (item: NaoConformidadeDashboardItem) => (
    <Button size="sm" variant={item.statusReparo === 'REPARADO' ? 'secondary' : 'primary'}
      aria-label={`${item.statusReparo === 'REPARADO' ? 'Ver detalhes da' : 'Tratar'} NC ${item.id}`}
      onClick={() => openRecord(item)}>
      {item.statusReparo === 'REPARADO' ? 'Ver detalhes' : 'Tratar'}
    </Button>
  );

  return <PageContainer size="wide" className="app-page space-y-5 py-6 sm:py-8">
    <PageHeader title="Não Conformidades" eyebrow="Qualidade · Acompanhamento"
      icon={<ClipboardCheck className="size-5" aria-hidden="true" />}
      description="Acompanhe as ocorrências registradas nos apontamentos e registre os reparos realizados."
      actions={<Button variant="secondary" isLoading={loading} loadingLabel="Atualizando"
        leftIcon={<RefreshCw className="size-4" aria-hidden="true" />} onClick={() => setRefresh((value) => value + 1)}>Atualizar</Button>} />

    <form onSubmit={applyFilters}>
      <FilterPanel description="Período pela data do apontamento. Indicadores e gráficos consideram todos os filtros aplicados."
        actions={<Button type="submit" disabled={invalidPeriod || loading} leftIcon={<Search className="size-4" aria-hidden="true" />}>Aplicar filtros</Button>}>
        <Field label="Data inicial"><DateInput value={filters.dataInicio} max={filters.dataFim || undefined}
          onChange={(e) => setFilters((current) => ({ ...current, dataInicio: e.target.value }))} /></Field>
        <Field label="Data final"><DateInput value={filters.dataFim} min={filters.dataInicio || undefined}
          onChange={(e) => setFilters((current) => ({ ...current, dataFim: e.target.value }))} /></Field>
        <Field label="Setor"><CustomSelect value={filters.setorId} options={setorOptions}
          onChange={(setorId) => setFilters((current) => ({ ...current, setorId }))} /></Field>
        <Field label="Status"><CustomSelect value={filters.status} options={statusOptions}
          onChange={(status) => setFilters((current) => ({ ...current, status: status as NaoConformidadesFiltros['status'] }))} /></Field>
        <Field label="OP ou número de série"><Input type="search" placeholder="Buscar OP ou série" value={filters.busca}
          onChange={(e) => setFilters((current) => ({ ...current, busca: e.target.value }))} /></Field>
      </FilterPanel>
      {invalidPeriod && <FieldError role="alert">Informe a data inicial e final, em ordem cronológica.</FieldError>}
    </form>

    {loading ? <LoadingState label="Carregando Não Conformidades..." /> : error ? (
      <ErrorState title="Não foi possível carregar as Não Conformidades" description={error}
        action={<Button onClick={() => setRefresh((value) => value + 1)}>Tentar novamente</Button>} />
    ) : <>
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
        <MetricCard aria-label="Total de NCs" label="Total de NCs" value={number(metrics.total)} icon={<ClipboardCheck className="size-5" />} />
        <MetricCard aria-label="Aguardando reparo" label="Aguardando reparo" value={number(metrics.aguardando)} tone="warning" icon={<Clock3 className="size-5" />} />
        <MetricCard aria-label="Reparadas" label="Reparadas" value={number(metrics.reparadas)} tone="success" icon={<CheckCircle2 className="size-5" />} />
        <MetricCard aria-label="Percentual reparadas" label="% Reparadas" value={`${metrics.percentualReparadas.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`} tone="primary" icon={<Percent className="size-5" />} />
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <SectionCard title="Não Conformidades por Setor" description="Quantidade por setor, do maior para o menor." className="min-w-0">
          {metrics.total ? <>
            <div role="img" aria-label={metrics.porSetor.map((s) => `${s.setor}: ${s.quantidade}`).join('; ')} style={{ height: Math.max(260, metrics.porSetor.length * 42) }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={metrics.porSetor} layout="vertical" margin={{ left: 0, right: 24, top: 8, bottom: 8 }}>
                  <CartesianGrid stroke="var(--border-subtle)" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} stroke="var(--text-secondary)" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="setor" width={115} stroke="var(--text-secondary)" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'var(--text-primary)' }} cursor={{ fill: 'var(--accent-soft)' }} />
                  <Bar dataKey="quantidade" name="NCs" fill="var(--accent)" radius={[0, 5, 5, 0]} maxBarSize={28} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </> : <EmptyState title="Sem NCs por setor" description="Nenhuma ocorrência no período e filtros aplicados." />}
        </SectionCard>
        <SectionCard title="Status das Não Conformidades" description="Distribuição dos registros nos filtros aplicados." className="min-w-0">
          {metrics.total ? <>
            <div className="h-56" role="img" aria-label={`Aguardando reparo: ${metrics.aguardando}; Reparado: ${metrics.reparadas}`}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" stroke="var(--surface-base)" isAnimationActive={false}>
                  {statusData.map((item) => <Cell key={item.name} fill={item.color} />)}
                </Pie><Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'var(--text-primary)' }} /></PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2 text-sm">{statusData.map((item) => <li key={item.name} className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: item.color }} aria-hidden="true" />{item.name}</span>
              <strong>{number(item.value)} · {(item.value / metrics.total * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</strong>
            </li>)}</ul>
          </> : <EmptyState title="Sem status para exibir" description="Os indicadores serão atualizados quando houver registros." />}
        </SectionCard>
      </div>

      <SectionCard title="Análise das Não Conformidades" description={`${number(metrics.total)} registro(s) nos filtros aplicados. Abra uma ocorrência para consultar todos os detalhes.`}>
        {!metrics.total ? <EmptyState title="Nenhuma Não Conformidade encontrada" description="Ajuste o período, setor, status ou busca. As NCs são cadastradas no Apontamento Diário." /> : <>
          <div className="hidden xl:block">
            <DataTable rows={data?.registros || []} getRowKey={(item) => item.id} caption="Não Conformidades detalhadas" columns={[
              { id: 'data', header: 'Data', cell: (item) => formatDateBR(item.data), className: 'whitespace-nowrap' },
              { id: 'setor', header: 'Setor / Turno', cell: (item) => <><p>{item.setor}{item.tipoBobina ? ` · ${item.tipoBobina}` : ''}</p><p className="mt-1 text-xs text-slate-400">{item.turno || '—'}</p></> },
              { id: 'op', header: 'OP / Série', cell: (item) => <div className="max-w-36"><p className="truncate" title={item.op}>OP: {item.op || '—'}</p><p className="mt-1 truncate text-xs text-slate-400" title={item.numeroSerie}>Série: {item.numeroSerie || '—'}</p></div> },
              { id: 'causa', header: 'Não conformidade', cell: (item) => <p className="line-clamp-2 max-w-64 [overflow-wrap:anywhere]">{item.causaNaoConformidade || 'Não informado'}</p> },
              { id: 'status', header: 'Status', cell: (item) => <ReparoBadge item={item} /> },
              { id: 'tempo', header: 'Tempo', cell: (item) => <><p className="whitespace-nowrap">{tempoNaoConformidade(item)}</p><p className="text-xs text-slate-400">{item.statusReparo === 'REPARADO' ? 'Resolução' : 'Em aberto'}</p></> },
              { id: 'reparado', header: 'Reparado em / por', cell: (item) => <><p className="whitespace-nowrap text-xs">{dateTime(item.reparadoEm)}</p><p className="mt-1 max-w-40 truncate text-xs text-slate-400" title={item.reparadoPorNome}>{item.reparadoPorNome || '—'}</p></> },
              { id: 'acao', header: 'Ação', cell: action },
            ]} />
          </div>
          <ul className="grid min-w-0 gap-3 md:grid-cols-2 xl:hidden">
            {data?.registros.map((item) => <li key={item.id} className="min-w-0"><Surface as="article" padding="md" tone="muted" className="h-full space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{formatDateBR(item.data)}</strong><ReparoBadge item={item} /></div>
              <p className="text-sm font-bold [overflow-wrap:anywhere]">{item.setor}{item.tipoBobina ? ` · ${item.tipoBobina}` : ''} · {item.turno || 'Turno não informado'}</p>
              <dl className="grid grid-cols-2 gap-3"><ReadonlyValue label="OP" value={item.op} /><ReadonlyValue label="Série" value={item.numeroSerie} /></dl>
              <p className="line-clamp-3 text-sm text-slate-300 [overflow-wrap:anywhere]">{item.causaNaoConformidade || 'Não informado'}</p>
              <p className="text-xs text-slate-400">{item.statusReparo === 'REPARADO' ? 'Tempo de resolução' : 'Tempo em aberto'}: {tempoNaoConformidade(item)}</p>
              {item.statusReparo === 'REPARADO' && <p className="text-xs text-slate-400 [overflow-wrap:anywhere]">Reparado em {dateTime(item.reparadoEm)} · {item.reparadoPorNome || 'Responsável não informado'}</p>}
              {action(item)}
            </Surface></li>)}
          </ul>
        </>}
      </SectionCard>
    </>}

    <ModalShell isOpen={Boolean(selected)} onClose={closeRecord} busy={saving} size="lg"
      title={canRepair ? 'Tratar Não Conformidade' : 'Detalhes da Não Conformidade'}
      initialFocusRef={canRepair ? descriptionRef : undefined}
      footer={canRepair ? <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" disabled={saving} onClick={closeRecord}>Cancelar</Button>
        <Button type="submit" form="nc-repair-form" disabled={!description.trim()} isLoading={saving} loadingLabel="Registrando reparo">Confirmar reparo</Button>
      </div> : <Button variant="secondary" onClick={closeRecord}>Fechar</Button>}>
      {selected && <div className="space-y-5">
        <dl className="grid grid-cols-2 gap-4">
          <ReadonlyValue label="Setor" value={`${selected.setor}${selected.tipoBobina ? ` · ${selected.tipoBobina}` : ''}`} />
          <ReadonlyValue label="Data" value={formatDateBR(selected.data)} />
          <ReadonlyValue label="Turno" value={selected.turno} />
          <ReadonlyValue label="OP" value={selected.op} />
          <ReadonlyValue label="Série" value={selected.numeroSerie} />
          <ReadonlyValue label="Registrada em" value={dateTime(selected.criadoEm)} />
          <ReadonlyValue className="col-span-2" label="Não conformidade" value={selected.causaNaoConformidade || 'Não informado'} />
        </dl>
        <ReparoBadge item={selected} />
        {canRepair ? <form id="nc-repair-form" onSubmit={(event) => void confirmRepair(event)}>
          <Field label="Como foi reparado?" required><textarea ref={descriptionRef} required rows={4} className="field-control" disabled={saving}
            value={description} onChange={(e) => { setDescription(e.target.value); setSaveError(''); }} /></Field>
          <FieldError role="alert">{saveError}</FieldError>
        </form> : <dl className="grid grid-cols-2 gap-4 rounded-xl border border-[var(--success-border)] bg-[var(--success-soft)] p-4">
          <ReadonlyValue className="col-span-2" label="Como foi reparado?" value={selected.descricaoReparo} />
          <ReadonlyValue label="Reparado em" value={dateTime(selected.reparadoEm)} />
          <ReadonlyValue label="Reparado por" value={selected.reparadoPorNome} />
          <ReadonlyValue label="Tempo de resolução" value={tempoNaoConformidade(selected)} />
        </dl>}
      </div>}
    </ModalShell>
    <Toast toast={toast} onClose={() => setToast(null)} />
  </PageContainer>;
}
