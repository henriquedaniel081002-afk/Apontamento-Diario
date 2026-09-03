import { Employee, ProductionRecord, ConsolidatedEmployeeDay, KPIStats, WorkdayConfig } from '../types';

/**
 * Calculates converted pieces based on the 2nd character of part code:
 * - Second letter 'T' or 't': quantity ÷ 3
 * - Second letter 'M' or 'm': quantity ÷ 2
 * - Second letter 'B' or 'b': quantity ÷ 2
 * - Other cases: original integer quantity
 */
export function calculateConvertedQuantity(rawQuantity: number, partCode: string): number {
  if (!partCode || partCode.length < 2) return rawQuantity;
  const secondChar = partCode.charAt(1).toUpperCase();
  
  if (secondChar === 'T') {
    return Math.floor(rawQuantity / 3);
  }
  if (secondChar === 'M') {
    return Math.floor(rawQuantity / 2);
  }
  if (secondChar === 'B') {
    return Math.floor(rawQuantity / 2);
  }
  return rawQuantity;
}

/**
 * Returns base standard minutes for a given date:
 * - Monday: 424 min
 * - Tuesday: 424 min
 * - Wednesday: 424 min
 * - Thursday: 424 min
 * - Friday: 389 min
 * - Saturday/Sunday: 0 min
 */
export function getStandardDayMinutes(dateStr: string, config?: WorkdayConfig['standardMinutes']): number {
  // Parse date without timezone shifts
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 1 = Mon, ..., 5 = Fri, 6 = Sat

  const mins = config || {
    monday: 424,
    tuesday: 424,
    wednesday: 424,
    thursday: 424,
    friday: 389,
    weekend: 0,
  };

  switch (dayOfWeek) {
    case 1: return mins.monday;
    case 2: return mins.tuesday;
    case 3: return mins.wednesday;
    case 4: return mins.thursday;
    case 5: return mins.friday;
    default: return mins.weekend;
  }
}

/**
 * Formats total minutes into hh:mm string (e.g. 424 -> "07:04", 1250 -> "20:50")
 */
export function formatMinutesToHHMM(totalMinutes: number): string {
  if (!totalMinutes || isNaN(totalMinutes) || totalMinutes <= 0) {
    return '00:00';
  }
  const rounded = Math.round(totalMinutes);
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Formats total minutes into human readable text (e.g. "7h 04m")
 */
export function formatMinutesToReadable(totalMinutes: number): string {
  if (!totalMinutes || isNaN(totalMinutes) || totalMinutes <= 0) {
    return '0m';
  }
  const rounded = Math.round(totalMinutes);
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

/**
 * Calculates friendly tenure between admission date and target/analyzed date:
 * Examples:
 * - "8 meses"
 * - "1 ano e 4 meses"
 * - "3 anos e 2 meses"
 * - "10 anos e 7 meses"
 */
export function calculateTenure(admissionDateStr: string, analyzedDateStr: string): string {
  if (!admissionDateStr || !analyzedDateStr) return '0 meses';
  
  const [aYear, aMonth, aDay] = admissionDateStr.split('-').map(Number);
  const [tYear, tMonth, tDay] = analyzedDateStr.split('-').map(Number);

  let years = tYear - aYear;
  let months = tMonth - aMonth;
  let days = tDay - aDay;

  if (days < 0) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years <= 0) {
    if (months <= 1) return '1 mês';
    return `${months} meses`;
  }

  const yearLabel = years === 1 ? '1 ano' : `${years} anos`;
  if (months === 0) {
    return yearLabel;
  }
  const monthLabel = months === 1 ? '1 mês' : `${months} meses`;
  return `${yearLabel} e ${monthLabel}`;
}

/**
 * Formats date from YYYY-MM-DD to DD/MM/YYYY
 */
export function formatDateBR(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Formats percentage with 1 or 2 decimals (e.g. 84,91%)
 */
export function formatPercentage(val: number, decimals: number = 1): string {
  if (isNaN(val) || !isFinite(val)) return '0,0%';
  return `${val.toFixed(decimals).replace('.', ',')}%`;
}

/**
 * Formats integer/float numbers with Brazilian thousands separator
 */
export function formatNumberBR(val: number, decimals: number = 0): string {
  if (isNaN(val) || !isFinite(val)) return '0';
  return val.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Groups raw production records by Employee + Date to create consolidated rows
 */
export function consolidateEmployeeDays(
  records: ProductionRecord[],
  employeesMap: Map<string, Employee>,
  config?: WorkdayConfig
): ConsolidatedEmployeeDay[] {
  // Key: `${date}_${employeeId}`
  const groupMap = new Map<string, {
    date: string;
    employeeId: string;
    records: ProductionRecord[];
  }>();

  for (const rec of records) {
    const key = `${rec.date}_${rec.employeeId}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        date: rec.date,
        employeeId: rec.employeeId,
        records: [],
      });
    }
    groupMap.get(key)!.records.push(rec);
  }

  const consolidated: ConsolidatedEmployeeDay[] = [];

  for (const item of groupMap.values()) {
    const employee = employeesMap.get(item.employeeId);
    if (!employee) continue;

    const baseMin = getStandardDayMinutes(item.date, config?.standardMinutes);
    
    // Sum all records for this employee on this date
    let totalProduced = 0;
    let totalStoppage = 0;
    let totalOvertime = 0;
    let totalConverted = 0;
    let totalRaw = 0;

    for (const r of item.records) {
      totalProduced += r.producedMinutes || 0;
      totalStoppage += r.stoppageMinutes || 0;
      // Hora extra pertence ao colaborador/dia e pode aparecer repetida em cada linha da view.
      // Usamos o maior valor do dia, não a soma das linhas.
      totalOvertime = Math.max(totalOvertime, r.overtimeMinutes || 0);
      totalConverted += r.convertedQuantity || 0;
      totalRaw += r.rawQuantity || 0;
    }

    const totalAvailable = baseMin + totalOvertime;
    const productivityPercent = totalAvailable > 0
      ? (totalProduced / totalAvailable) * 100
      : 0;

    const tenureText = ''; // Sem BASE DE FUNCIONARIOS não há data de admissão confiável.

    consolidated.push({
      date: item.date,
      employeeId: item.employeeId,
      employee,
      tenureText,
      totalProducedMinutes: totalProduced,
      totalAvailableMinutes: totalAvailable,
      totalOvertimeMinutes: totalOvertime,
      totalStoppageMinutes: totalStoppage,
      totalConvertedPieces: Math.round(totalConverted * 100) / 100,
      totalRawPieces: totalRaw,
      productivityPercent: Math.round(productivityPercent * 100) / 100,
      recordsCount: item.records.length,
      records: item.records,
    });
  }

  // Sort default by date desc, then employee name asc
  consolidated.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return a.employee.name.localeCompare(b.employee.name);
  });

  return consolidated;
}

/**
 * Calculates overall KPIs based on filtered records, employees in scope, and configured workdays.
 */
export function calculateKPIs(
  consolidatedDays: ConsolidatedEmployeeDay[],
  employeesInScope: Employee[],
  startDate: string,
  endDate: string,
  officialWorkdays: string[],
  config?: WorkdayConfig
): KPIStats {
  let totalConvertedPieces = 0;
  let totalRawPieces = 0;
  let totalProducedMinutes = 0;
  let totalAvailableMinutes = 0;
  let totalStoppageMinutes = 0;

  // Map to group by date for trend
  const dateTrendMap = new Map<string, {
    date: string;
    producedMin: number;
    availableMin: number;
    pieces: number;
  }>();

  for (const cDay of consolidatedDays) {
    totalConvertedPieces += cDay.totalConvertedPieces;
    totalRawPieces += cDay.totalRawPieces;
    totalProducedMinutes += cDay.totalProducedMinutes;
    totalAvailableMinutes += cDay.totalAvailableMinutes;
    totalStoppageMinutes += cDay.totalStoppageMinutes;

    if (!dateTrendMap.has(cDay.date)) {
      dateTrendMap.set(cDay.date, {
        date: cDay.date,
        producedMin: 0,
        availableMin: 0,
        pieces: 0,
      });
    }
    const dt = dateTrendMap.get(cDay.date)!;
    dt.producedMin += cDay.totalProducedMinutes;
    dt.availableMin += cDay.totalAvailableMinutes;
    dt.pieces += cDay.totalConvertedPieces;
  }

  // Overall productivity %
  const productivityPercent = totalAvailableMinutes > 0
    ? (totalProducedMinutes / totalAvailableMinutes) * 100
    : 0;

  // Faltas sem BASE DE FUNCIONÁRIOS:
  // - a matrícula passa a ser acompanhada a partir da primeira data em que aparece na produção;
  // - em cada dia oficial de trabalho dentro do filtro, ausência de qualquer produção = 1 falta.
  const presenceKeys = new Set(consolidatedDays.map(day => `${day.employeeId}|${day.date}`));
  const workdaysInRange = officialWorkdays.filter(date =>
    (!startDate || date >= startDate) && (!endDate || date <= endDate)
  );

  let totalAbsences = 0;
  for (const employee of employeesInScope) {
    const firstProductionDate = employee.firstProductionDate || employee.admissionDate;
    if (!firstProductionDate) continue;

    const employeeStart = startDate && startDate > firstProductionDate
      ? startDate
      : firstProductionDate;

    for (const workday of workdaysInRange) {
      if (workday < employeeStart) continue;
      // Colaboradores desligados deixam de ser esperados a partir do dia seguinte ao desligamento.
      // O próprio dia do desligamento ainda pode ser um dia normal de trabalho.
      if (employee.terminationDate && workday > employee.terminationDate) continue;
      if (!presenceKeys.has(`${employee.id}|${workday}`)) totalAbsences += 1;
    }
  }

  // Build daily trend list sorted by date ascending
  const sortedDates = Array.from(dateTrendMap.keys()).sort();
  const dailyTrend = sortedDates.map(d => {
    const item = dateTrendMap.get(d)!;
    const prod = item.availableMin > 0 ? (item.producedMin / item.availableMin) * 100 : 0;
    return {
      date: d,
      formattedDate: formatDateBR(d).slice(0, 5), // "DD/MM"
      productivity: Math.round(prod * 10) / 10,
      producedMin: item.producedMin,
      availableMin: item.availableMin,
      pieces: Math.round(item.pieces),
    };
  });

  // Find best day
  let bestDay: KPIStats['bestDay'] = null;
  if (dailyTrend.length > 0) {
    const maxDay = [...dailyTrend].sort((a, b) => b.productivity - a.productivity)[0];
    if (maxDay && maxDay.productivity > 0) {
      bestDay = {
        date: maxDay.date,
        formattedDate: formatDateBR(maxDay.date),
        productivity: maxDay.productivity,
      };
    }
  }

  const avgProductivity = dailyTrend.length > 0
    ? dailyTrend.reduce((acc, curr) => acc + curr.productivity, 0) / dailyTrend.length
    : productivityPercent;

  return {
    totalConvertedPieces: Math.round(totalConvertedPieces * 100) / 100,
    totalRawPieces,
    totalAvailableMinutes,
    totalProducedMinutes,
    productivityPercent: Math.round(productivityPercent * 100) / 100,
    totalStoppageMinutes,
    totalAbsences,
    dailyTrend,
    bestDay,
    avgProductivity: Math.round(avgProductivity * 10) / 10,
  };
}
