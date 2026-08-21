export const formatNum = (num: number, decimals = 0) =>
  num.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

export const formatPct = (num: number) => `${formatNum(num, 2)}%`;
