import { describe, expect, it } from 'vitest';
import {
  buildFinalImportGroups,
  classifyRawProductionGroup,
  type ProductionImportPreview,
} from './importProductionExcel';

describe('equivalências da importação de produção', () => {
  it('separa Bobina AT e mantém a linha de produção', () => {
    expect(classifyRawProductionGroup({
      id: 'bobina-at',
      setorOriginal: 'BOBINA AT',
      linhaOriginal: 'MON',
      potencia: 15,
      quantidade: 85,
    })).toEqual({
      group: {
        setor: 'BOBINA AT/BT',
        tipoBobina: 'AT',
        linha: 'MON',
        potencia: 15,
        quantidade: 85,
      },
    });
  });


  it('mantém EPO em setores produtivos reconhecidos sem converter para TRI', () => {
    expect(classifyRawProductionGroup({
      id: 'bobina-epo',
      setorOriginal: 'BOBINA AT',
      linhaOriginal: 'EPO',
      potencia: 75,
      quantidade: 6,
    })).toEqual({
      group: {
        setor: 'BOBINA AT/BT',
        tipoBobina: 'AT',
        linha: 'EPO',
        potencia: 75,
        quantidade: 6,
      },
    });
  });
  it('direciona somente MONTAGEM FINAL + EPO ao Epóxi', () => {
    expect(classifyRawProductionGroup({
      id: 'epoxi',
      setorOriginal: 'MONTAGEM FINAL',
      linhaOriginal: 'EPO',
      potencia: 150,
      quantidade: 4,
    })).toEqual({
      group: {
        setor: 'EPOXI',
        linha: 'EPO',
        potencia: 150,
        quantidade: 4,
      },
    });
  });

  it('mantém EPO de Ferragem no próprio setor', () => {
    expect(classifyRawProductionGroup({
      id: 'ferragem-epo',
      setorOriginal: 'FERRAGEM',
      linhaOriginal: 'EPO',
      potencia: 150,
      quantidade: 4,
    })).toEqual({
      group: {
        setor: 'FERRAGEM',
        linha: 'EPO',
        potencia: 150,
        quantidade: 4,
      },
    });
  });

  it('exige correção manual para BIF/POT em setor reconhecido', () => {
    const result = classifyRawProductionGroup({
      id: 'bif',
      setorOriginal: 'MONTAGEM FINAL',
      linhaOriginal: 'BIF',
      potencia: 75,
      quantidade: 12,
    });

    expect(result.issue).toEqual(expect.objectContaining({
      kind: 'LINHA',
      allowedLines: ['MON', 'TRI', 'EPO'],
    }));
  });

  it('aplica a linha corrigida e agrega antes de enviar ao servidor', () => {
    const preview: ProductionImportPreview = {
      fileName: 'Apontamento 2026.xlsx',
      data: '2026-08-19',
      rowsProcessed: 10,
      rowsMatched: 10,
      ignoredWithoutPower: 0,
      validGroups: [{ setor: 'MONTAGEM FINAL', linha: 'MON', potencia: 75, quantidade: 3 }],
      issues: [{
        id: 'bif',
        setorOriginal: 'MONTAGEM FINAL',
        linhaOriginal: 'BIF',
        potencia: 75,
        quantidade: 12,
        kind: 'LINHA',
        allowedLines: ['MON', 'TRI', 'EPO'],
        message: 'corrigir',
      }],
    };

    expect(buildFinalImportGroups(preview, { bif: 'MON' })).toEqual([
      { setor: 'MONTAGEM FINAL', linha: 'MON', potencia: 75, quantidade: 15 },
    ]);
  });

  it('reconhece Ferragem e Corte do Núcleo para o Dashboard', () => {
    expect(classifyRawProductionGroup({
      id: 'ferragem',
      setorOriginal: 'FERRAGEM',
      linhaOriginal: 'MON',
      potencia: 75,
      quantidade: 3,
    })).toEqual({ group: { setor: 'FERRAGEM', linha: 'MON', potencia: 75, quantidade: 3 } });

    expect(classifyRawProductionGroup({
      id: 'corte-nucleo',
      setorOriginal: 'CORTE DO NÚCLEO',
      linhaOriginal: 'TRI',
      potencia: 112.5,
      quantidade: 7,
    })).toEqual({ group: { setor: 'CORTE DO NUCLEO', linha: 'TRI', potencia: 112.5, quantidade: 7 } });


    expect(classifyRawProductionGroup({
      id: 'ferragem-pa',
      setorOriginal: 'FERRAGEM PA / ACESSÓRIOS',
      linhaOriginal: 'EPO',
      potencia: 45,
      quantidade: 2,
    })).toEqual({ group: { setor: 'FERRAGEM', linha: 'EPO', potencia: 45, quantidade: 2 } });
  });
});
