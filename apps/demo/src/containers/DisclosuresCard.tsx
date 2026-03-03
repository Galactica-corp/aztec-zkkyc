import React from 'react';
import { Eye, AlertTriangle } from 'lucide-react';
import { useAztecWallet, hasAppManagedPXE } from '../aztec-wallet';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from '../components/ui';
import { useDisclosureEvents, useShamirDisclosureEvents } from '../hooks';
import { iconSize, truncateAddress } from '../utils';

const styles = {
  headerRow: 'flex flex-row items-start gap-4',
  headerIcon: 'text-accent',
  formContainer: 'space-y-6',
  section:
    'space-y-4 rounded-lg border border-default bg-surface-secondary p-4',
  sectionTitle: 'text-sm font-semibold text-default mb-2',
  loadingContainer:
    'flex flex-col items-center justify-center py-8 gap-4 text-muted',
  loadingSpinner:
    'animate-spin rounded-full h-8 w-8 border-2 border-current border-t-transparent',
  loadingText: 'text-sm',
  errorContainer: 'text-center py-6',
  errorIcon: 'text-amber-500 mx-auto mb-2',
  errorTitle: 'text-lg font-semibold text-default mb-1',
  errorText: 'text-sm text-muted',
  eventList: 'space-y-2',
  eventRow:
    'flex flex-wrap items-center gap-x-2 gap-y-1 text-sm rounded border border-default bg-surface-tertiary p-2',
  eventLabel: 'text-muted shrink-0',
  eventValue: 'font-mono text-default break-all',
  disclosureUnsupported: 'text-sm text-muted',
  disclosureRefreshButton: 'mt-2',
} as const;

export const DisclosuresCard: React.FC = () => {
  const { account, connector, connectors, isPXEInitialized, currentConfig } =
    useAztecWallet();

  const {
    events: directDisclosureEvents,
    isLoading: directDisclosureEventsLoading,
    isError: directDisclosureEventsError,
    error: directDisclosureEventsErrorDetail,
    refetch: refetchDirectDisclosureEvents,
  } = useDisclosureEvents({
    enabled: Boolean(
      (Boolean(account) ||
        connectors.some((c) => c.getStatus().status === 'connected')) &&
        isPXEInitialized
    ),
  });

  const {
    events: shamirDisclosureEvents,
    isLoading: shamirDisclosureEventsLoading,
    isError: shamirDisclosureEventsError,
    error: shamirDisclosureEventsErrorDetail,
    refetch: refetchShamirDisclosureEvents,
  } = useShamirDisclosureEvents({
    enabled: Boolean(
      (Boolean(account) ||
        connectors.some((c) => c.getStatus().status === 'connected')) &&
        isPXEInitialized
    ),
  });

  const isAnyWalletConnected =
    Boolean(account) ||
    connectors.some((conn) => conn.getStatus().status === 'connected');
  const showForm = isAnyWalletConnected && isPXEInitialized;

  if (!showForm) {
    return null;
  }

  return (
    <Card>
      <CardHeader className={styles.headerRow}>
        <Eye size={iconSize('xl')} className={styles.headerIcon} />
        <div>
          <CardTitle>Disclosures</CardTitle>
          <CardDescription>
            View private direct and Shamir disclosure events for the connected
            account.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className={styles.formContainer}>
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Direct disclosure events</h3>
          {currentConfig?.basicDisclosureContractAddress &&
          connector &&
          hasAppManagedPXE(connector) ? (
            <>
              {directDisclosureEventsLoading ? (
                <div className={styles.loadingContainer}>
                  <div className={styles.loadingSpinner} />
                  <p className={styles.loadingText}>Loading…</p>
                </div>
              ) : directDisclosureEventsError ? (
                <div className={styles.errorContainer}>
                  <AlertTriangle
                    size={iconSize('2xl')}
                    className={styles.errorIcon}
                  />
                  <p className={styles.errorTitle}>Failed to load events</p>
                  <p className={styles.errorText}>
                    {directDisclosureEventsErrorDetail?.message ??
                      'Failed to load disclosure events'}
                  </p>
                </div>
              ) : (
                <>
                  <div className={styles.eventList}>
                    {directDisclosureEvents.length === 0 ? (
                      <p className={styles.disclosureUnsupported}>
                        No disclosure events for this account yet.
                      </p>
                    ) : (
                      directDisclosureEvents.map((item, index) => (
                        <div
                          key={`${item.event.unique_id?.toString?.() ?? index}-${index}`}
                          className={styles.eventRow}
                        >
                          <span className={styles.eventLabel}>from:</span>
                          <span
                            className={styles.eventValue}
                            title={item.event.from?.toString?.() ?? ''}
                          >
                            {truncateAddress(item.event.from?.toString?.())}
                          </span>
                          <span className={styles.eventLabel}>context:</span>
                          <span className={styles.eventValue}>
                            {item.event.context?.toString?.() ??
                              String(item.event.context)}
                          </span>
                          <span className={styles.eventLabel}>guardian:</span>
                          <span
                            className={styles.eventValue}
                            title={item.event.guardian?.toString?.() ?? ''}
                          >
                            {truncateAddress(item.event.guardian?.toString?.())}
                          </span>
                          <span className={styles.eventLabel}>unique_id:</span>
                          <span className={styles.eventValue}>
                            {item.event.unique_id?.toString?.() ??
                              String(item.event.unique_id)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => refetchDirectDisclosureEvents()}
                    disabled={directDisclosureEventsLoading}
                    className={styles.disclosureRefreshButton}
                  >
                    Refresh
                  </Button>
                </>
              )}
            </>
          ) : (
            <p className={styles.disclosureUnsupported}>
              Disclosure events are only available when using Embedded or
              External Signer wallet.
            </p>
          )}
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Shamir disclosure events</h3>
          {currentConfig?.shamirDisclosureContractAddress &&
          connector &&
          hasAppManagedPXE(connector) ? (
            <>
              {shamirDisclosureEventsLoading ? (
                <div className={styles.loadingContainer}>
                  <div className={styles.loadingSpinner} />
                  <p className={styles.loadingText}>Loading…</p>
                </div>
              ) : shamirDisclosureEventsError ? (
                <div className={styles.errorContainer}>
                  <AlertTriangle
                    size={iconSize('2xl')}
                    className={styles.errorIcon}
                  />
                  <p className={styles.errorTitle}>Failed to load events</p>
                  <p className={styles.errorText}>
                    {shamirDisclosureEventsErrorDetail?.message ??
                      'Failed to load Shamir disclosure events'}
                  </p>
                </div>
              ) : (
                <>
                  <div className={styles.eventList}>
                    {shamirDisclosureEvents.length === 0 ? (
                      <p className={styles.disclosureUnsupported}>
                        No Shamir disclosure events for this account yet.
                      </p>
                    ) : (
                      shamirDisclosureEvents.map((item, index) => (
                        <div
                          key={`${item.event.shard_x?.toString?.() ?? index}-${item.event.shard_y?.toString?.() ?? index}-${index}`}
                          className={styles.eventRow}
                        >
                          <span className={styles.eventLabel}>from:</span>
                          <span
                            className={styles.eventValue}
                            title={item.event.from?.toString?.() ?? ''}
                          >
                            {truncateAddress(item.event.from?.toString?.())}
                          </span>
                          <span className={styles.eventLabel}>context:</span>
                          <span className={styles.eventValue}>
                            {item.event.context?.toString?.() ??
                              String(item.event.context)}
                          </span>
                          <span className={styles.eventLabel}>shard_x:</span>
                          <span className={styles.eventValue}>
                            {item.event.shard_x?.toString?.() ??
                              String(item.event.shard_x)}
                          </span>
                          <span className={styles.eventLabel}>shard_y:</span>
                          <span className={styles.eventValue}>
                            {item.event.shard_y?.toString?.() ??
                              String(item.event.shard_y)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => refetchShamirDisclosureEvents()}
                    disabled={shamirDisclosureEventsLoading}
                    className={styles.disclosureRefreshButton}
                  >
                    Refresh
                  </Button>
                </>
              )}
            </>
          ) : (
            <p className={styles.disclosureUnsupported}>
              Shamir disclosure events are only available when using Embedded or
              External Signer wallet.
            </p>
          )}
        </section>
      </CardContent>
    </Card>
  );
};
