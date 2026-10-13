import { describe, expect, it } from 'vitest';
import { programacaoImportSector } from './importProgramacaoExcel';

describe('programação dos setores Epóxi', () => {
  it.each(['BOBINAGEM EPOXI', 'ENCAPSULAMENTO'])('preserva %s separadamente', (setor) => {
    expect(programacaoImportSector(setor)).toBe(setor);
  });
  it('não altera o setor EPOXI existente', () => {
    expect(programacaoImportSector('EPOXI')).toBe('EPOXI');
  });
});
