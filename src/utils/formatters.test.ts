import { describe, expect, it } from 'vitest';
import { formatDateBR, formatDateShort, formatPotencia, parsePotencia } from './formatters';

describe('formatadores de domínio', () => {
  it('formata datas sem deslocamento de fuso', () => {
    expect(formatDateBR('2026-08-14')).toBe('14/08/2026');
    expect(formatDateShort('2026-08-14')).toBe('14 AGO 2026');
  });

  it('aceita potência com vírgula ou ponto', () => {
    expect(parsePotencia('112,5')).toBe(112.5);
    expect(parsePotencia('112.5')).toBe(112.5);
    expect(formatPotencia(112.5)).toBe('112,5');
  });

  it('mantém os fallbacks atuais para entradas inválidas', () => {
    expect(parsePotencia('')).toBe(0);
    expect(parsePotencia('abc')).toBe(0);
    expect(formatDateBR('')).toBe('');
  });
});
