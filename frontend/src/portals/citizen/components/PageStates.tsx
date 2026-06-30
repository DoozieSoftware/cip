import { type JSX, type ReactNode } from 'react';
import { EmptyState, ErrorState, Spinner } from '../../moderator/design';

/**
 * T-M13-020 — Standard loading / error / empty / data render helper
 * for the citizen pages.
 *
 *   <PageStates
 *     query={me}
 *     loadingLabel="Loading profile"
 *     emptyTitle="No notifications yet"
 *     emptyDescription="…"
 *     onRetry={() => me.refetch()}
 *   >
 *     {(data) => <YourView data={data} />}
 *   </PageStates>
 */
export interface PageStatesProps<T> {
  query: {
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    data: T | undefined;
    refetch: () => unknown;
  };
  loadingLabel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  errorTitle?: string;
  errorDescription?: string;
  onRetry?: () => void;
  children: (data: T) => ReactNode;
}

export function PageStates<T>({
  query,
  loadingLabel = 'Loading',
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
  errorTitle = 'Couldn\u2019t load this page',
  errorDescription,
  onRetry,
  children,
}: PageStatesProps<T>): JSX.Element {
  if (query.isLoading) {
    return <Spinner label={loadingLabel} />;
  }
  if (query.isError) {
    const err = query.error instanceof Error ? query.error : null;
    return (
      <ErrorState
        title={errorTitle}
        description={errorDescription ?? 'Please retry, or pull to refresh.'}
        error={err}
        action={
          <button
            type="button"
            onClick={() => (onRetry ? onRetry() : query.refetch())}
            className="mt-2 rounded-md bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700"
          >
            Retry
          </button>
        }
      />
    );
  }
  if (query.data == null) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }
  return <>{children(query.data as T)}</>;
}
