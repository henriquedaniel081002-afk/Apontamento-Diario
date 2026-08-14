/**
 * Formats a date string (YYYY-MM-DD) into Portuguese display format.
 */
export function formatDateBR(dateString: string): string {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  if (!year || !month || !day) return dateString;
  return `${day}/${month}/${year}`;
}

export function formatDateShort(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString + 'T00:00:00');
  const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

export function getTodayDateString(): string {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Parses a string power input (e.g. "37,5" or "112.5") to a number.
 */
export function parsePotencia(value: string): number {
  if (!value) return 0;
  const sanitized = value.trim().replace(',', '.');
  const parsed = parseFloat(sanitized);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Formats a power number into Brazilian locale format (e.g. 112.5 -> "112,5")
 */
export function formatPotencia(value: number): string {
  if (value === undefined || value === null) return '0';
  if (Number.isInteger(value)) return value.toString();
  return value.toString().replace('.', ',');
}
