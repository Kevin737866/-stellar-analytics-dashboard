/**
 * ApiErrorMessage – issue #340
 *
 * Displays a classified, user-friendly error from the API.
 *
 * Features:
 * - Reads `extensions.userMessage` (and `extensions.code`) that the API
 *   server attaches via its `formatError` hook.
 * - Picks an appropriate icon and colour depending on the error category.
 * - Renders a "Try again" button when `onRetry` is supplied.
 * - Falls back gracefully when `userMessage` is absent (older API version or
 *   pure network errors).
 *
 * Usage:
 *   const { data, loading, error, refetch } = useQuery(MY_QUERY);
 *   if (error) return <ApiErrorMessage error={error} onRetry={refetch} />;
 */

import type { ApolloError } from '@apollo/client';
import {
  AlertTriangle,
  ServerCrash,
  ShieldOff,
  SearchX,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import { useApiError } from '@/hooks/useApiError';

interface ApiErrorMessageProps {
  /** The Apollo error object returned by `useQuery` / `useMutation` */
  error: ApolloError | undefined;
  /** Optional callback wired to the "Try again" button */
  onRetry?: () => void;
  /** Optional extra CSS classes on the wrapper */
  className?: string;
}

export function ApiErrorMessage({ error, onRetry, className = '' }: ApiErrorMessageProps) {
  const { hasError, message, isUnauthenticated, isNotFound, isValidation, isServerError } =
    useApiError(error);

  if (!hasError) return null;

  // Pick icon + colour based on error category
  const iconClass = 'h-10 w-10 mb-3 flex-shrink-0';

  let Icon = AlertTriangle;
  let borderColour = 'border-destructive/25';
  let bgColour = 'bg-destructive/5';
  let iconColour = 'text-destructive';
  let heading = 'Something went wrong';

  if (isUnauthenticated) {
    Icon = ShieldOff;
    borderColour = 'border-yellow-400/30';
    bgColour = 'bg-yellow-50 dark:bg-yellow-950/20';
    iconColour = 'text-yellow-600 dark:text-yellow-400';
    heading = 'Access denied';
  } else if (isNotFound) {
    Icon = SearchX;
    borderColour = 'border-muted/40';
    bgColour = 'bg-muted/10';
    iconColour = 'text-muted-foreground';
    heading = 'Not found';
  } else if (isValidation) {
    Icon = AlertTriangle;
    borderColour = 'border-orange-400/30';
    bgColour = 'bg-orange-50 dark:bg-orange-950/20';
    iconColour = 'text-orange-600 dark:text-orange-400';
    heading = 'Invalid request';
  } else if (isServerError) {
    // Check for network vs server errors
    if (error?.networkError) {
      Icon = WifiOff;
      heading = 'Network error';
    } else {
      Icon = ServerCrash;
      heading = 'Server error';
    }
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`flex flex-col items-center justify-center text-center p-8 rounded-xl border ${borderColour} ${bgColour} ${className}`}
    >
      <Icon className={`${iconClass} ${iconColour}`} aria-hidden="true" />
      <h3 className="text-base font-semibold mb-1">{heading}</h3>
      <p className="text-sm text-muted-foreground max-w-xs">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Try again
        </button>
      )}
    </div>
  );
}
