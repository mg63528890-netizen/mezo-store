/**
 * Formatting and digit conversion utilities for Mezo Store
 * All amounts in Egyptian pounds, Western digits (0-9) only in both languages.
 * Cairo timezone (Africa/Cairo)
 */

export const CAIRO_TIMEZONE = 'Africa/Cairo';

/**
 * Converts Arabic-Indic digits (٠-٩) typed on an Arabic keyboard to Western digits (0-9).
 * Used on every numeric, phone, and IMEI input field.
 */
export function convertArabicIndicDigits(input: string): string {
  if (!input) return '';
  const arabicIndic = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return input.replace(/[٠-٩]/g, (char) => {
    const idx = arabicIndic.indexOf(char);
    return idx !== -1 ? idx.toString() : char;
  });
}

/**
 * Formats monetary amounts:
 * - Stored as numeric(12,2)
 * - Shown without decimals when whole, two decimals otherwise
 * - Always Western digits (0-9)
 * - Thousands separators
 * - Suffix: ج.م in Arabic, EGP in English
 */
export function formatCurrency(amount: number | string | null | undefined, lang: 'ar' | 'en' = 'ar'): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return lang === 'ar' ? '0 ج.م' : '0 EGP';
  }

  const num = Number(amount);
  const isWhole = Number.isInteger(num);

  const formattedNum = new Intl.NumberFormat('ar-EG-u-nu-latn', {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(num);

  return lang === 'ar' ? `${formattedNum} ج.م` : `${formattedNum} EGP`;
}

/**
 * Formats pure numbers with Western digits and thousands separators (e.g. 52,000)
 */
export function formatNumber(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '0';
  }
  const num = Number(amount);
  const isWhole = Number.isInteger(num);
  return new Intl.NumberFormat('ar-EG-u-nu-latn', {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(num);
}

/**
 * Format a date/time string with Cairo timezone and Western digits
 */
export function formatCairoDate(
  dateValue: string | Date,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' },
  lang: 'ar' | 'en' = 'ar'
): string {
  const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
  const locale = lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US';

  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: CAIRO_TIMEZONE,
  }).format(date);
}

/**
 * Short date format for charts and lists (e.g. "5 أكتوبر" or "5 Oct")
 */
export function formatShortDate(dateValue: string | Date, lang: 'ar' | 'en' = 'ar'): string {
  return formatCairoDate(dateValue, { day: 'numeric', month: 'long' }, lang);
}

/**
 * Invoice date/time for details header (e.g. "2026/10/11 5:51:49 م")
 */
export function formatInvoiceTimestamp(dateValue: string | Date, lang: 'ar' | 'en' = 'ar'): string {
  const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
  const locale = lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US';

  const dateStr = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: CAIRO_TIMEZONE,
  }).format(date);

  return dateStr;
}
