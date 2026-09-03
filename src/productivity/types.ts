export type SectorType = string;
export type ShiftType = '1º Turno' | '2º Turno' | 'Não informado';
export type EmployeeStatus = 'Ativo' | 'Desligado' | 'Inativo' | 'Férias' | 'Afastado';

export interface Employee {
  id: string;
  registration: string;
  name: string;
  sector: SectorType;
  shift: ShiftType;
  admissionDate: string;
  firstProductionDate?: string;
  terminationDate?: string;
  role: string;
  avatar?: string;
  status: EmployeeStatus;
}

export interface ProductionRecord {
  id: string;
  employeeId: string;
  date: string;
  partCode: string;
  description: string;
  op?: string;
  drawing?: string;
  className?: string;
  power?: string;
  sector?: string;
  machine?: string;
  rawQuantity: number;
  convertedQuantity: number;
  producedMinutes: number;
  stoppageMinutes: number;
  stoppageReason?: string;
  overtimeMinutes: number;
  notes?: string;
}

export interface FilterState {
  startDate: string;
  endDate: string;
  sector: string;
  shift: string;
  employeeSearch: string;
  employeeId: string;
}

export interface ConsolidatedEmployeeDay {
  date: string;
  employeeId: string;
  employee: Employee;
  tenureText: string;
  totalProducedMinutes: number;
  totalAvailableMinutes: number;
  totalOvertimeMinutes: number;
  totalStoppageMinutes: number;
  totalConvertedPieces: number;
  totalRawPieces: number;
  productivityPercent: number;
  recordsCount: number;
  records: ProductionRecord[];
}

export interface KPIStats {
  totalConvertedPieces: number;
  totalRawPieces: number;
  totalAvailableMinutes: number;
  totalProducedMinutes: number;
  productivityPercent: number;
  totalStoppageMinutes: number;
  totalAbsences: number;
  dailyTrend: {
    date: string;
    formattedDate: string;
    productivity: number;
    producedMin: number;
    availableMin: number;
    pieces: number;
  }[];
  bestDay: {
    date: string;
    formattedDate: string;
    productivity: number;
  } | null;
  avgProductivity: number;
}

export interface WorkdayConfig {
  officialWorkdays: string[];
  conversionRules: {
    letter: string;
    divisor: number;
    description: string;
  }[];
  standardMinutes: {
    monday: number;
    tuesday: number;
    wednesday: number;
    thursday: number;
    friday: number;
    weekend: number;
  };
  productivityTarget: number;
}
