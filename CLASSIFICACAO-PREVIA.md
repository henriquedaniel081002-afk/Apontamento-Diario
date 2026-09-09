# Classificação prévia — redesign ITAM

Regra: somente os sete arquivos VISUAIS abaixo podem ser editados. Todo o restante está protegido como FUNCIONAL/fora do escopo. React com estado, regras, consultas ou autenticação permanece integralmente intacto. ui.tsx é um conjunto de componentes de apresentação: apenas classes e estilos serão alterados; props, cálculos de progresso, eventos e estrutura de dados serão preservados.

| Arquivo | Classificação |
|---|---|
| `.env.example` | FUNCIONAL — preservar |
| `.gitignore` | FUNCIONAL — preservar |
| `README.md` | FUNCIONAL — preservar |
| `index.html` | FUNCIONAL — preservar |
| `package-lock.json` | FUNCIONAL — preservar |
| `package.json` | FUNCIONAL — preservar |
| `public/icons/apple-touch-icon.png` | FUNCIONAL — preservar |
| `public/icons/icon-192.png` | FUNCIONAL — preservar |
| `public/icons/icon-512.png` | FUNCIONAL — preservar |
| `public/icons/icon-maskable-512.png` | FUNCIONAL — preservar |
| `public/manifest.webmanifest` | FUNCIONAL — preservar |
| `public/sw.js` | FUNCIONAL — preservar |
| `server.ts` | FUNCIONAL — preservar |
| `src/App.tsx` | FUNCIONAL — preservar |
| `src/aderencia-anual/AderenciaAnualPage.test.tsx` | FUNCIONAL — preservar |
| `src/aderencia-anual/AderenciaAnualPage.tsx` | FUNCIONAL — preservar |
| `src/aderencia-anual/components/AderenciaAnualChart.tsx` | FUNCIONAL — preservar |
| `src/aderencia-anual/components/AderenciaAnualImport.tsx` | FUNCIONAL — preservar |
| `src/aderencia-anual/services/aderenciaAnualService.test.ts` | FUNCIONAL — preservar |
| `src/aderencia-anual/services/aderenciaAnualService.ts` | FUNCIONAL — preservar |
| `src/aderencia-anual/types.ts` | FUNCIONAL — preservar |
| `src/aderencia-anual/utils/metrics.test.ts` | FUNCIONAL — preservar |
| `src/aderencia-anual/utils/metrics.ts` | FUNCIONAL — preservar |
| `src/aderencia-anual/utils/parseAderenciaAnualExcel.test.ts` | FUNCIONAL — preservar |
| `src/aderencia-anual/utils/parseAderenciaAnualExcel.ts` | FUNCIONAL — preservar |
| `src/assets/logo-itam.png` | FUNCIONAL — preservar |
| `src/atraso/atraso.css` | VISUAL |
| `src/atraso/components/AtrasoImportModal.tsx` | FUNCIONAL — preservar |
| `src/atraso/components/AtrasoPrintModal.tsx` | FUNCIONAL — preservar |
| `src/atraso/services/atrasoService.ts` | FUNCIONAL — preservar |
| `src/atraso/types.ts` | FUNCIONAL — preservar |
| `src/atraso/utils/importAtrasoExcel.test.ts` | FUNCIONAL — preservar |
| `src/atraso/utils/importAtrasoExcel.ts` | FUNCIONAL — preservar |
| `src/atraso/utils/printAtrasos.ts` | FUNCIONAL — preservar |
| `src/components/apontamento/FaltasSection.tsx` | FUNCIONAL — preservar |
| `src/components/apontamento/ImportedProductionSection.tsx` | FUNCIONAL — preservar |
| `src/components/apontamento/NaoConformidadesSection.tsx` | FUNCIONAL — preservar |
| `src/components/apontamento/ObservacoesSection.tsx` | FUNCIONAL — preservar |
| `src/components/apontamento/ParadasFaltaMaterialSection.tsx` | FUNCIONAL — preservar |
| `src/components/apontamento/ParadasMaquinaSection.tsx` | FUNCIONAL — preservar |
| `src/components/apontamento/ProducaoSection.tsx` | FUNCIONAL — preservar |
| `src/components/apontamento/ReviewSection.tsx` | FUNCIONAL — preservar |
| `src/components/apontamento/SummaryHeader.tsx` | FUNCIONAL — preservar |
| `src/components/common/ConfirmModal.tsx` | FUNCIONAL — preservar |
| `src/components/common/CustomSelect.tsx` | FUNCIONAL — preservar |
| `src/components/common/GlobalLoadingOverlay.tsx` | FUNCIONAL — preservar |
| `src/components/common/Header.test.tsx` | FUNCIONAL — preservar |
| `src/components/common/Header.tsx` | FUNCIONAL — preservar |
| `src/components/common/LineSelector.tsx` | FUNCIONAL — preservar |
| `src/components/common/ModalShell.test.tsx` | FUNCIONAL — preservar |
| `src/components/common/ModalShell.tsx` | FUNCIONAL — preservar |
| `src/components/common/ShiftSelector.tsx` | FUNCIONAL — preservar |
| `src/components/common/Toast.tsx` | FUNCIONAL — preservar |
| `src/components/common/ui.test.tsx` | FUNCIONAL — preservar |
| `src/components/common/ui.tsx` | VISUAL |
| `src/components/coordenacao/CoordinationRecords.test.tsx` | FUNCIONAL — preservar |
| `src/components/coordenacao/CoordinationRecords.tsx` | FUNCIONAL — preservar |
| `src/components/coordenacao/CoordinationSettingsModal.tsx` | FUNCIONAL — preservar |
| `src/components/coordenacao/DeleteApontamentosModal.tsx` | FUNCIONAL — preservar |
| `src/components/coordenacao/EditApontamentoModal.tsx` | FUNCIONAL — preservar |
| `src/components/coordenacao/ImportProductionModal.tsx` | FUNCIONAL — preservar |
| `src/components/coordenacao/ImportProgramacaoModal.tsx` | FUNCIONAL — preservar |
| `src/components/historico/DetailModal.tsx` | FUNCIONAL — preservar |
| `src/components/historico/HistoryRecords.tsx` | FUNCIONAL — preservar |
| `src/dashboard/components/Charts.test.tsx` | FUNCIONAL — preservar |
| `src/dashboard/components/Charts.tsx` | FUNCIONAL — preservar |
| `src/dashboard/components/DayDetailModal.test.tsx` | FUNCIONAL — preservar |
| `src/dashboard/components/DayDetailModal.tsx` | FUNCIONAL — preservar |
| `src/dashboard/components/EpoxiDayDetailModal.tsx` | FUNCIONAL — preservar |
| `src/dashboard/components/FilterBar.tsx` | FUNCIONAL — preservar |
| `src/dashboard/components/MetricPanels.test.tsx` | FUNCIONAL — preservar |
| `src/dashboard/components/MetricPanels.tsx` | FUNCIONAL — preservar |
| `src/dashboard/controle-faltas.css` | VISUAL |
| `src/dashboard/dashboard.css` | VISUAL |
| `src/dashboard/dashboards/EpoxiDashboard.test.tsx` | FUNCIONAL — preservar |
| `src/dashboard/dashboards/EpoxiDashboard.tsx` | FUNCIONAL — preservar |
| `src/dashboard/dashboards/MonthlyDashboard.test.tsx` | FUNCIONAL — preservar |
| `src/dashboard/dashboards/MonthlyDashboard.tsx` | FUNCIONAL — preservar |
| `src/dashboard/lib/formatters.ts` | FUNCIONAL — preservar |
| `src/dashboard/lib/utils.ts` | FUNCIONAL — preservar |
| `src/dashboard/types.ts` | FUNCIONAL — preservar |
| `src/hooks/useLoadingProgress.ts` | FUNCIONAL — preservar |
| `src/index.css` | VISUAL |
| `src/main.tsx` | FUNCIONAL — preservar |
| `src/mocks/mockData.ts` | FUNCIONAL — preservar |
| `src/pages/ApontamentoPage.test.tsx` | FUNCIONAL — preservar |
| `src/pages/ApontamentoPage.tsx` | FUNCIONAL — preservar |
| `src/pages/AtrasoPage.tsx` | FUNCIONAL — preservar |
| `src/pages/ControleFaltasPage.tsx` | FUNCIONAL — preservar |
| `src/pages/CoordenacaoPage.tsx` | FUNCIONAL — preservar |
| `src/pages/DashboardPage.test.tsx` | FUNCIONAL — preservar |
| `src/pages/DashboardPage.tsx` | FUNCIONAL — preservar |
| `src/pages/HistoricoPage.tsx` | FUNCIONAL — preservar |
| `src/pages/LoginPage.test.tsx` | FUNCIONAL — preservar |
| `src/pages/LoginPage.tsx` | FUNCIONAL — preservar |
| `src/pages/ProducaoDiariaPage.test.tsx` | FUNCIONAL — preservar |
| `src/pages/ProducaoDiariaPage.tsx` | FUNCIONAL — preservar |
| `src/pages/ProdutividadeIndividualPage.tsx` | FUNCIONAL — preservar |
| `src/pages/TurnOccurrencePage.tsx` | FUNCIONAL — preservar |
| `src/producao-diaria/metrics.test.ts` | FUNCIONAL — preservar |
| `src/producao-diaria/metrics.ts` | FUNCIONAL — preservar |
| `src/producao-diaria/producao-diaria.css` | VISUAL |
| `src/producao-diaria/types.ts` | FUNCIONAL — preservar |
| `src/productivity/components/EmployeeDetailView.tsx` | FUNCIONAL — preservar |
| `src/productivity/components/FilterBar.tsx` | FUNCIONAL — preservar |
| `src/productivity/components/ImportView.tsx` | FUNCIONAL — preservar |
| `src/productivity/components/KpiCards.tsx` | FUNCIONAL — preservar |
| `src/productivity/components/LateralAnalyticsPanel.tsx` | FUNCIONAL — preservar |
| `src/productivity/components/ProductivityTable.tsx` | FUNCIONAL — preservar |
| `src/productivity/components/SettingsView.tsx` | FUNCIONAL — preservar |
| `src/productivity/lib/supabase.ts` | FUNCIONAL — preservar |
| `src/productivity/productivity.css` | VISUAL |
| `src/productivity/services/dashboardService.ts` | FUNCIONAL — preservar |
| `src/productivity/services/importService.ts` | FUNCIONAL — preservar |
| `src/productivity/types.ts` | FUNCIONAL — preservar |
| `src/productivity/utils/calculations.test.ts` | FUNCIONAL — preservar |
| `src/productivity/utils/calculations.ts` | FUNCIONAL — preservar |
| `src/services/apiClient.test.ts` | FUNCIONAL — preservar |
| `src/services/apiClient.ts` | FUNCIONAL — preservar |
| `src/services/apontamentoService.ts` | FUNCIONAL — preservar |
| `src/services/authService.ts` | FUNCIONAL — preservar |
| `src/services/controleFaltasService.ts` | FUNCIONAL — preservar |
| `src/services/coordenacaoService.ts` | FUNCIONAL — preservar |
| `src/services/dashboardService.ts` | FUNCIONAL — preservar |
| `src/services/loadingProgressService.ts` | FUNCIONAL — preservar |
| `src/services/producaoDiariaService.ts` | FUNCIONAL — preservar |
| `src/services/sessionStore.test.ts` | FUNCIONAL — preservar |
| `src/services/sessionStore.ts` | FUNCIONAL — preservar |
| `src/test/setup.ts` | FUNCIONAL — preservar |
| `src/types/index.ts` | FUNCIONAL — preservar |
| `src/utils/exportExcel.test.ts` | FUNCIONAL — preservar |
| `src/utils/exportExcel.ts` | FUNCIONAL — preservar |
| `src/utils/formatters.test.ts` | FUNCIONAL — preservar |
| `src/utils/formatters.ts` | FUNCIONAL — preservar |
| `src/utils/importProductionExcel.test.ts` | FUNCIONAL — preservar |
| `src/utils/importProductionExcel.ts` | FUNCIONAL — preservar |
| `src/utils/importProgramacaoExcel.ts` | FUNCIONAL — preservar |
| `src/utils/operational.test.ts` | FUNCIONAL — preservar |
| `src/utils/operational.ts` | FUNCIONAL — preservar |
| `src/vite-env.d.ts` | FUNCIONAL — preservar |
| `tsconfig.json` | FUNCIONAL — preservar |
| `vercel.json` | FUNCIONAL — preservar |
| `vite.config.ts` | FUNCIONAL — preservar |
| `vitest.config.ts` | FUNCIONAL — preservar |

Documentos novos de entrega: REDESIGN-ITAM.md, CLASSIFICACAO-PREVIA.md e INTEGRIDADE-REDESIGN.json. Classificação DOCUMENTAÇÃO; não participam da execução da aplicação.
