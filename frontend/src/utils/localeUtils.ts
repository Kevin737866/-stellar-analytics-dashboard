import { useTranslation } from 'react-i18next';

/**
 * Format a date according to the current locale
 * @param date - Date string or Date object
 * @param options - Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export function formatDate(
  date: string | Date,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleString(undefined, options);
}

/**
 * Format a time according to the current locale
 * @param date - Date string or Date object
 * @param options - Intl.DateTimeFormatOptions
 * @returns Formatted time string
 */
export function formatTime(
  date: string | Date,
  options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleTimeString(undefined, options);
}

/**
 * Format a date in relative time (e.g., "2 hours ago")
 * @param date - Date string or Date object
 * @returns Relative time string
 */
export function formatRelativeTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

  if (diffSecs < 60) {
    return rtf.format(-diffSecs, 'second');
  } else if (diffMins < 60) {
    return rtf.format(-diffMins, 'minute');
  } else if (diffHours < 24) {
    return rtf.format(-diffHours, 'hour');
  } else if (diffDays < 7) {
    return rtf.format(-diffDays, 'day');
  } else {
    return formatDate(dateObj, { year: 'numeric', month: 'short', day: 'numeric' });
  }
}

/**
 * Format a number according to the current locale
 * @param value - Number to format
 * @param options - Intl.NumberFormatOptions
 * @returns Formatted number string
 */
export function formatNumber(
  value: number,
  options: Intl.NumberFormatOptions = {}
): string {
  return value.toLocaleString(undefined, options);
}

/**
 * Format a currency amount according to the current locale
 * @param value - Number to format
 * @param currency - Currency code (default: USD)
 * @param options - Intl.NumberFormatOptions
 * @returns Formatted currency string
 */
export function formatCurrency(
  value: number,
  currency: string = 'USD',
  options: Intl.NumberFormatOptions = {}
): string {
  return value.toLocaleString(undefined, {
    style: 'currency',
    currency,
    ...options,
  });
}

/**
 * Format a percentage according to the current locale
 * @param value - Number between 0 and 1
 * @param options - Intl.NumberFormatOptions
 * @returns Formatted percentage string
 */
export function formatPercent(
  value: number,
  options: Intl.NumberFormatOptions = {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }
): string {
  return (value * 100).toLocaleString(undefined, {
    style: 'percent',
    ...options,
  });
}

/**
 * Format a Stellar amount (in stroops) to XLM
 * @param stroops - Amount in stroops (1 XLM = 10,000,000 stroops)
 * @param options - Intl.NumberFormatOptions
 * @returns Formatted XLM string
 */
export function formatXLM(
  stroops: number,
  options: Intl.NumberFormatOptions = {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  }
): string {
  const xlm = stroops / 10000000;
  return `${formatNumber(xlm, options)} XLM`;
}

/**
 * Hook to get locale-aware formatting functions
 * @returns Object with formatting functions
 */
export function useLocaleFormat() {
  const { i18n } = useTranslation();

  const getLocale = () => i18n.language;

  const formatDateWithLocale = (
    date: string | Date,
    options?: Intl.DateTimeFormatOptions
  ): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleString(getLocale(), options);
  };

  const formatTimeWithLocale = (
    date: string | Date,
    options?: Intl.DateTimeFormatOptions
  ): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleTimeString(getLocale(), options);
  };

  const formatNumberWithLocale = (
    value: number,
    options?: Intl.NumberFormatOptions
  ): string => {
    return value.toLocaleString(getLocale(), options);
  };

  const formatCurrencyWithLocale = (
    value: number,
    currency: string = 'USD',
    options?: Intl.NumberFormatOptions
  ): string => {
    return value.toLocaleString(getLocale(), {
      style: 'currency',
      currency,
      ...options,
    });
  };

  const formatPercentWithLocale = (
    value: number,
    options?: Intl.NumberFormatOptions
  ): string => {
    return (value * 100).toLocaleString(getLocale(), {
      style: 'percent',
      ...options,
    });
  };

  const formatXLMWithLocale = (
    stroops: number,
    options?: Intl.NumberFormatOptions
  ): string => {
    const xlm = stroops / 10000000;
    return `${formatNumberWithLocale(xlm, options)} XLM`;
  };

  const formatRelativeTimeWithLocale = (date: string | Date): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    const rtf = new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto' });

    if (diffSecs < 60) {
      return rtf.format(-diffSecs, 'second');
    } else if (diffMins < 60) {
      return rtf.format(-diffMins, 'minute');
    } else if (diffHours < 24) {
      return rtf.format(-diffHours, 'hour');
    } else if (diffDays < 7) {
      return rtf.format(-diffDays, 'day');
    } else {
      return formatDateWithLocale(dateObj, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
  };

  return {
    formatDate: formatDateWithLocale,
    formatTime: formatTimeWithLocale,
    formatNumber: formatNumberWithLocale,
    formatCurrency: formatCurrencyWithLocale,
    formatPercent: formatPercentWithLocale,
    formatXLM: formatXLMWithLocale,
    formatRelativeTime: formatRelativeTimeWithLocale,
  };
}
