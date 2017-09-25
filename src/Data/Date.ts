import { getDateTimeFormat } from 'VSS/Utils/Culture';
import { parseLocale, localeFormat } from 'VSS/Utils/Date';

export function parseDate(s: string): Date {
    return parseLocale(s, getDateTimeFormat().ShortDatePattern, true);
}

export function format(date: Date): string {
    return localeFormat(date, getDateTimeFormat().ShortDatePattern, true);
}