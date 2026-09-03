import { describe, expect, it } from 'vitest';
import { calculateConvertedQuantity, getStandardDayMinutes } from './calculations';

describe('regras preservadas da Produtividade Individual', () => {
  it('trunca peças convertidas conforme a segunda letra do desenho', () => {
    expect(calculateConvertedQuantity(9, 'AM123')).toBe(4);
    expect(calculateConvertedQuantity(10, 'AT123')).toBe(3);
    expect(calculateConvertedQuantity(9, 'AB123')).toBe(4);
    expect(calculateConvertedQuantity(9, 'AX123')).toBe(9);
  });

  it('mantém 424 minutos de segunda a quinta, 389 na sexta e zero no fim de semana', () => {
    expect(getStandardDayMinutes('2026-08-31')).toBe(424); // segunda
    expect(getStandardDayMinutes('2026-09-01')).toBe(424); // terça
    expect(getStandardDayMinutes('2026-09-02')).toBe(424); // quarta
    expect(getStandardDayMinutes('2026-09-03')).toBe(424); // quinta
    expect(getStandardDayMinutes('2026-09-04')).toBe(389); // sexta
    expect(getStandardDayMinutes('2026-09-05')).toBe(0); // sábado
  });
});
