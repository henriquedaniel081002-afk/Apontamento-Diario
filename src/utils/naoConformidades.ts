import type { NaoConformidadeDashboardItem } from '../types/naoConformidades';

export function tempoNaoConformidade(
  item: Pick<NaoConformidadeDashboardItem, 'criadoEm' | 'statusReparo' | 'reparadoEm'>,
  agora = Date.now(),
): string {
  const inicio = Date.parse(item.criadoEm);
  const fim = item.statusReparo === 'REPARADO' ? Date.parse(item.reparadoEm || '') : agora;
  if (!Number.isFinite(inicio) || !Number.isFinite(fim) || fim < inicio) return '—';
  const minutos = Math.floor((fim - inicio) / 60_000);
  if (minutos < 60) return minutos ? `${minutos}min` : '< 1min';
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas}h`;
  const dias = Math.floor(horas / 24);
  return `${dias}d${horas % 24 ? ` ${horas % 24}h` : ''}`;
}

export function calcularIndicadoresNC(registros: NaoConformidadeDashboardItem[]) {
  const total = registros.length;
  let reparadas = 0;
  const setores = new Map<string, { setor: string; quantidade: number }>();
  for (const item of registros) {
    if (item.statusReparo === 'REPARADO') reparadas++;
    const setor = setores.get(item.setorId) || { setor: item.setor, quantidade: 0 };
    setor.quantidade++;
    setores.set(item.setorId, setor);
  }
  return {
    total,
    aguardando: total - reparadas,
    reparadas,
    percentualReparadas: total ? (reparadas / total) * 100 : 0,
    porSetor: [...setores.values()].sort((a, b) => b.quantidade - a.quantidade || a.setor.localeCompare(b.setor, 'pt-BR')),
  };
}
