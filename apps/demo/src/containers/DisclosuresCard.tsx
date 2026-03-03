import React from 'react';
import { Eye, AlertTriangle } from 'lucide-react';
import { Fr } from '@aztec/aztec.js/fields';
import { useAztecWallet, hasAppManagedPXE } from '../aztec-wallet';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
} from '../components/ui';
import { useDisclosureEvents, useShamirDisclosureEvents } from '../hooks';
import { iconSize, truncateAddress } from '../utils';

type ShardPoint = {
  x: bigint;
  y: bigint;
};

const mod = (value: bigint, prime: bigint): bigint => {
  const result = value % prime;
  return result >= 0n ? result : result + prime;
};

const extendedGcd = (a: bigint, b: bigint): [bigint, bigint, bigint] => {
  let oldR = a;
  let r = b;
  let oldS = 1n;
  let s = 0n;
  let oldT = 0n;
  let t = 1n;

  while (r !== 0n) {
    const quotient = oldR / r;
    [oldR, r] = [r, oldR - quotient * r];
    [oldS, s] = [s, oldS - quotient * s];
    [oldT, t] = [t, oldT - quotient * t];
  }

  return [oldR, oldS, oldT];
};

const modInverse = (value: bigint, prime: bigint): bigint => {
  const [gcd, x] = extendedGcd(mod(value, prime), prime);
  if (gcd !== 1n) {
    throw new Error(
      'Shard coordinates are invalid: denominator has no modular inverse.'
    );
  }
  return mod(x, prime);
};

const decryptShamirTwoOfThree = (shards: [ShardPoint, ShardPoint]): bigint => {
  const recipientAmount = 3n;
  const prime = Fr.MODULUS;
  const seenX = new Set<bigint>();

  const normalizedPoints = shards.map((shard, idx) => {
    if (shard.x <= 0n || shard.x > recipientAmount) {
      throw new Error(
        `Shard x-coordinate ${shard.x.toString()} is outside expected recipient range 1..3.`
      );
    }
    if (seenX.has(shard.x)) {
      throw new Error(
        `Duplicate shard x-coordinate detected: ${shard.x.toString()}.`
      );
    }

    seenX.add(shard.x);
    return { x: shard.x, y: mod(shard.y, prime), sourceIndex: idx };
  });

  let secret = 0n;
  for (let i = 0; i < normalizedPoints.length; i++) {
    const point = normalizedPoints[i];
    let numerator = 1n;
    let denominator = 1n;

    for (let j = 0; j < normalizedPoints.length; j++) {
      if (i === j) continue;
      const otherPoint = normalizedPoints[j];
      numerator = mod(numerator * -otherPoint.x, prime);
      denominator = mod(denominator * (point.x - otherPoint.x), prime);
    }

    const basisAtZero = mod(numerator * modInverse(denominator, prime), prime);
    secret = mod(secret + point.y * basisAtZero, prime);
  }

  return secret;
};

const parseShardValue = (value: string, label: string): bigint => {
  const trimmed = value.trim();
  if (trimmed === '') {
    throw new Error(`${label} is required.`);
  }

  try {
    return BigInt(trimmed);
  } catch {
    throw new Error(`${label} must be an integer.`);
  }
};

const styles = {
  headerRow: 'flex flex-row items-start gap-4',
  headerIcon: 'text-accent',
  formContainer: 'space-y-6',
  section:
    'space-y-4 rounded-lg border border-default bg-surface-secondary p-4',
  thresholdDescription: 'text-sm text-muted',
  thresholdGrid: 'grid grid-cols-1 gap-4 md:grid-cols-2',
  thresholdActions: 'flex items-center gap-3',
  thresholdResultLabel: 'text-sm font-semibold text-default',
  thresholdResultValue:
    'rounded border border-default bg-surface-tertiary p-2 font-mono text-sm text-default break-all',
  thresholdError: 'text-sm text-red-500',
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
  const [shardOneX, setShardOneX] = React.useState('');
  const [shardOneY, setShardOneY] = React.useState('');
  const [shardTwoX, setShardTwoX] = React.useState('');
  const [shardTwoY, setShardTwoY] = React.useState('');
  const [decryptedSecret, setDecryptedSecret] = React.useState<string | null>(
    null
  );
  const [decryptError, setDecryptError] = React.useState<string | null>(null);

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

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Shamir threshold decryption</h3>
          <p className={styles.thresholdDescription}>
            Reconstruct the shared secret using 2 out of 3 Shamir shards.
          </p>
          <div className={styles.thresholdGrid}>
            <Input
              label="Shard 1 x"
              value={shardOneX}
              onChange={(event) => setShardOneX(event.target.value)}
              placeholder="e.g. 1"
            />
            <Input
              label="Shard 1 y"
              value={shardOneY}
              onChange={(event) => setShardOneY(event.target.value)}
              placeholder="e.g. 123456"
            />
            <Input
              label="Shard 2 x"
              value={shardTwoX}
              onChange={(event) => setShardTwoX(event.target.value)}
              placeholder="e.g. 2"
            />
            <Input
              label="Shard 2 y"
              value={shardTwoY}
              onChange={(event) => setShardTwoY(event.target.value)}
              placeholder="e.g. 654321"
            />
          </div>
          <div className={styles.thresholdActions}>
            <Button
              variant="secondary"
              onClick={() => {
                try {
                  setDecryptError(null);
                  const shardA: ShardPoint = {
                    x: parseShardValue(shardOneX, 'Shard 1 x'),
                    y: parseShardValue(shardOneY, 'Shard 1 y'),
                  };
                  const shardB: ShardPoint = {
                    x: parseShardValue(shardTwoX, 'Shard 2 x'),
                    y: parseShardValue(shardTwoY, 'Shard 2 y'),
                  };
                  const secret = decryptShamirTwoOfThree([shardA, shardB]);
                  setDecryptedSecret(secret.toString());
                } catch (error) {
                  setDecryptedSecret(null);
                  setDecryptError(
                    error instanceof Error
                      ? error.message
                      : 'Failed to decrypt shards.'
                  );
                }
              }}
            >
              Decrypt
            </Button>
          </div>
          {decryptError && <p className={styles.thresholdError}>{decryptError}</p>}
          {decryptedSecret && (
            <div>
              <p className={styles.thresholdResultLabel}>Decrypted secret</p>
              <p className={styles.thresholdResultValue}>{decryptedSecret}</p>
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
};
