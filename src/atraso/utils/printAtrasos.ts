import type { AtrasoRecord } from '../types';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDateBR(value: string): string {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || '-');
}

function formatPower(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '-';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
}

export function printAtrasos(rows: AtrasoRecord[], setorLabel: string, linhaLabel: string): void {
  const sorted = [...rows].sort((a, b) =>
    a.data_programada.localeCompare(b.data_programada)
      || a.serie - b.serie,
  );

  const popup = window.open('', '_blank', 'width=1200,height=800');
  if (!popup) {
    throw new Error('O navegador bloqueou a janela de impressão. Permita pop-ups para este site e tente novamente.');
  }

  try { popup.opener = null; } catch { /* proteção adicional sem bloquear a impressão */ }

  const generatedAt = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date());

  const bodyRows = sorted.map((row) => `
    <tr>
      <td class="num">${escapeHtml(row.serie)}</td>
      <td>${escapeHtml(formatDateBR(row.data_programada))}</td>
      <td>${escapeHtml(row.cliente || '-')}</td>
      <td class="num">${escapeHtml(row.op ?? '-')}</td>
      <td>${escapeHtml(row.linha || '-')}</td>
      <td class="num">${escapeHtml(formatPower(row.potencia))}</td>
      <td>${escapeHtml(row.setor || '-')}</td>
    </tr>`).join('');

  popup.document.open();
  popup.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Relatório de Atrasos - ITAM</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111827; background: #fff; font-size: 10px; }
    header { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #111827; }
    h1 { margin: 0; font-size: 18px; line-height: 1.1; }
    .subtitle { margin-top: 4px; color: #4b5563; font-size: 10px; }
    .meta { text-align: right; color: #4b5563; line-height: 1.45; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    th, td { border: 1px solid #9ca3af; padding: 5px 6px; vertical-align: middle; word-break: break-word; }
    th { background: #e5e7eb; color: #111827; font-size: 9px; text-transform: uppercase; letter-spacing: .03em; text-align: left; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; }
    th:nth-child(1), td:nth-child(1) { width: 9%; }
    th:nth-child(2), td:nth-child(2) { width: 11%; }
    th:nth-child(3), td:nth-child(3) { width: 30%; }
    th:nth-child(4), td:nth-child(4) { width: 9%; }
    th:nth-child(5), td:nth-child(5) { width: 9%; }
    th:nth-child(6), td:nth-child(6) { width: 10%; }
    th:nth-child(7), td:nth-child(7) { width: 22%; }
    .empty { padding: 30px; text-align: center; color: #6b7280; }
    footer { margin-top: 8px; display: flex; justify-content: space-between; gap: 12px; color: #6b7280; font-size: 8px; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Relatório de Atrasos</h1>
      <div class="subtitle">ITAM — Controle de Atrasos de Produção</div>
    </div>
    <div class="meta">
      <div><strong>Setor:</strong> ${escapeHtml(setorLabel)}</div>
      <div><strong>Linha:</strong> ${escapeHtml(linhaLabel)}</div>
      <div><strong>Registros:</strong> ${sorted.length.toLocaleString('pt-BR')}</div>
    </div>
  </header>
  <table>
    <thead>
      <tr>
        <th>Série</th>
        <th>Data Prog.</th>
        <th>Cliente</th>
        <th>OP</th>
        <th>Linha</th>
        <th>Potência</th>
        <th>Setor</th>
      </tr>
    </thead>
    <tbody>${bodyRows || '<tr><td colspan="7" class="empty">Nenhum atraso encontrado para os filtros selecionados.</td></tr>'}</tbody>
  </table>
  <footer>
    <span>Ordenação: Data Prog. crescente; Série crescente.</span>
    <span>Gerado em ${escapeHtml(generatedAt)}</span>
  </footer>
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 150);
    });
  <\/script>
</body>
</html>`);
  popup.document.close();
}
