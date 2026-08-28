/**
 * useApiError – issue #340
 *
 * Extracts a user-friendly message from any Apollo GraphQL / network error.
 *
 * The API server (via the `formatError` hook) attaches a `userMessage` string
 * and a `code` string to every error's `extensions` object.  This hook reads
 * those fields and falls back gracefully when they are absent (e.g. for pure
 * network errors or errors from an older API version).
 *
 * Usage:
 *   const { message, code, hasError } = useApiError(error);
 *
 *   if (hasError) return <ApiErrorMessage error={error} />;
 */

import { useMemo } from 'react';
import type { ApolloError } from '@apollo/client';

export interface ApiErrorInfo {
  /** True when there is at least one error to display */
  hasError: boolean;
  /**
   * User-safe message ready to display in the UI.
   * Derived from the first error's `extensions.userMessage`, or a generic
   * network-error fallback, or the raw Apollo error message.
   */
  message: string;
  /**
   * Classified error code from the API (e.g. "NOT_FOUND", "UNAUTHENTICATED").
   * Undefined when the API did not supply one (e.g. pure network errors).
   */
  code: string | undefined;
  /**
   * All classified error codes present in the response (one per GraphQL error).
   * Useful for handling multi-error responses.
   */
  codes: string[];
  /** Whether this error indicates the user needs to log in */
  isUnauthenticated: boolean;
  /** Whether this error indicates a resource was not found */
  isNotFound: boolean;
  /** Whether this error indicates invalid user input */
  isValidation: boolean;
  /** Whether this error is a transient server / network problem */
  isServerError: boolean;
}

/** Fallback message shown when a network error carries no useful text */
const NETWORK_ERROR_MESSAGE =
  'Unable to reach the server. Please check your connection and try again.';

/** Generic fallback used as a last resort */
const GENERIC_FALLBACK = 'An unexpected error occurred. Please try again in a moment.';

export function useApiError(error: ApolloError | undefined): ApiErrorInfo {
  return useMemo(() => {
    if (!error) {
      return {
        hasError: false,
        message: '',
        code: undefined,
        codes: [],
        isUnauthenticated: false,
        isNotFound: false,
        isValidation: false,
        isServerError: false,
      };
    }

    // Collect codes from all GraphQL errors in the response
    const codes: string[] = (error.graphQLErrors ?? [])
      .map((e) => e.extensions?.code as string | undefined)
      .filter((c): c is string => typeof c === 'string');

    // Primary code comes from the first error
    const primaryCode = codes[0];

    // Derive the display message:
    //   1. extensions.userMessage from the first GraphQL error (set by API #340)
    //   2. networkError message for connection failures
    //   3. First graphQLError message (may still be technical in dev)
    //   4. Generic fallback
    let message: string;
    const firstGraphQLError = error.graphQLErrors?.[0];

    if (firstGraphQLError?.extensions?.userMessage) {
      message = firstGraphQLError.extensions.userMessage as string;
    } else if (error.networkError) {
      message = NETWORK_ERROR_MESSAGE;
    } else if (firstGraphQLError?.message) {
      message = firstGraphQLError.message;
    } else {
      message = error.message || GENERIC_FALLBACK;
    }

    const isUnauthenticated =
      codes.includes('UNAUTHENTICATED') ||
      codes.includes('FORBIDDEN');

    const isNotFound = codes.includes('NOT_FOUND');

    const isValidation =
      codes.includes('VALIDATION_ERROR') ||
      codes.includes('BAD_USER_INPUT') ||
      codes.includes('QUERY_TOO_COMPLEX');

    const isServerError =
      !isUnauthenticated &&
      !isNotFound &&
      !isValidation &&
      (codes.includes('INTERNAL_ERROR') ||
        codes.includes('SERVICE_UNAVAILABLE') ||
        codes.includes('TIMEOUT') ||
        !!error.networkError ||
        codes.length === 0);

    return {
      hasError: true,
      message,
      code: primaryCode,
      codes,
      isUnauthenticated,
      isNotFound,
      isValidation,
      isServerError,
    };
  }, [error]);
}
