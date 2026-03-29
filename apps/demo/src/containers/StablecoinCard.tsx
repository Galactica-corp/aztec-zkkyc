import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Landmark, RefreshCw } from 'lucide-react';
import { PrivateStablecoinContract } from '../../../../artifacts/PrivateStablecoin';
import { TokenBridgeContract } from '../../../../artifacts/TokenBridge';
import { hasAppManagedPXE, useAztecWallet } from '../aztec-wallet';
import {
  SharedPXEService,
  registerAddressAsSender,
} from '../aztec-wallet/services/aztec/pxe';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Input,
  Button,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../components/ui';
import { PLACEHOLDER_ADDRESS } from '../config/deployments';
import { useToast } from '../hooks';
import { useReadContract, useWriteContract } from '../hooks/contracts';
import { useRequiredContracts } from '../hooks/contracts/useRequiredContracts';
import { useFeePayment } from '../store/feePayment';
import { cn, iconSize } from '../utils';

const styles = {
  headerRow: 'flex flex-row items-start gap-4',
  headerIcon: 'text-accent',
  content: 'space-y-6',
  section:
    'space-y-4 rounded-lg border border-default bg-surface-secondary p-4',
  sectionHeader: 'space-y-1',
  sectionTitle: 'text-base font-semibold text-default',
  sectionDescription: 'text-sm text-muted',
  sectionNote: 'text-xs text-muted',
  sectionUnavailable:
    'rounded-lg border border-default bg-surface-tertiary p-3 text-sm text-muted',
  formGroup: 'space-y-2',
  row: 'flex flex-col gap-2 sm:flex-row sm:items-end',
  inputFlex: 'flex-1 min-w-0',
  balancePanel:
    'rounded-lg border border-default bg-surface-tertiary p-4 space-y-2',
  balanceHeader: 'flex items-center justify-between gap-2',
  balanceTitle: 'text-sm font-semibold text-default',
  balanceValue: 'text-2xl font-semibold text-default font-mono break-all',
  balanceHint: 'text-xs text-muted',
  inlineStatus: 'text-sm text-muted',
  errorText: 'text-sm text-red-500',
  loadingContainer:
    'flex flex-col items-center justify-center gap-3 py-6 text-muted',
  loadingSpinner:
    'animate-spin rounded-full h-6 w-6 border-2 border-current border-t-transparent',
} as const;

const ZERO_FIELD = 0n;

const parseField = (value: string): bigint | null => {
  if (value.trim() === '') {
    return null;
  }

  try {
    const parsed = BigInt(value);
    return parsed >= 0n ? parsed : null;
  } catch {
    return null;
  }
};

const formatReadResult = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
};

export const StablecoinCard: React.FC = () => {
  const {
    account,
    address: connectedAddress,
    connectors,
    connector,
    currentConfig,
    isPXEInitialized,
  } = useAztecWallet();
  const { success, error: toastError } = useToast();
  const { method: feePaymentMethod } = useFeePayment();
  const { readContract } = useReadContract();
  const { writeContract, isPending: writePending } = useWriteContract();

  const [bridgeClaimRecipient, setBridgeClaimRecipient] = useState('');
  const [bridgeClaimAmount, setBridgeClaimAmount] = useState('');
  const [bridgeClaimSecret, setBridgeClaimSecret] = useState('');
  const [bridgeClaimLeafIndex, setBridgeClaimLeafIndex] = useState('');
  const [bridgeWithdrawalRecipient, setBridgeWithdrawalRecipient] =
    useState('');
  const [bridgeWithdrawalAmount, setBridgeWithdrawalAmount] = useState('');
  const [stablecoinTransferTo, setStablecoinTransferTo] = useState('');
  const [stablecoinTransferAmount, setStablecoinTransferAmount] = useState('');
  const [discoverSenderAddress, setDiscoverSenderAddress] = useState('');
  const [stablecoinName, setStablecoinName] = useState('Private stablecoin');
  const [privateBalance, setPrivateBalance] = useState<bigint | null>(null);
  const [isStablecoinLoading, setIsStablecoinLoading] = useState(true);
  const [isStablecoinRefreshing, setIsStablecoinRefreshing] = useState(false);
  const [stablecoinLoadError, setStablecoinLoadError] = useState<string | null>(
    null
  );

  const isAnyWalletConnected =
    Boolean(account) ||
    connectors.some((currentConnector) => {
      return currentConnector.getStatus().status === 'connected';
    });
  const connectorStatus = connector?.getStatus().status;
  const isWalletBusy =
    connectorStatus === 'connecting' || connectorStatus === 'deploying';

  const bridgeAddress = currentConfig?.tokenBridgeContractAddress ?? '';
  const stablecoinAddress =
    currentConfig?.privateStablecoinContractAddress ?? '';
  const isBridgeConfigured =
    bridgeAddress !== '' && bridgeAddress !== PLACEHOLDER_ADDRESS;
  const isStablecoinConfigured =
    stablecoinAddress !== '' && stablecoinAddress !== PLACEHOLDER_ADDRESS;
  const requiredContracts = useMemo(
    () =>
      [
        ...(isBridgeConfigured ? (['tokenBridge'] as const) : []),
        ...(isStablecoinConfigured ? (['privateStablecoin'] as const) : []),
      ] as ('tokenBridge' | 'privateStablecoin')[],
    [isBridgeConfigured, isStablecoinConfigured]
  );
  const {
    isLoading: contractsLoading,
    hasError: contractsHasError,
    failedContracts,
    pendingContracts,
    statuses,
  } = useRequiredContracts(requiredContracts);
  const isBridgeReady = !isBridgeConfigured || statuses.tokenBridge === 'ready';
  const isStablecoinReady =
    !isStablecoinConfigured || statuses.privateStablecoin === 'ready';

  const stablecoinDescription = useMemo(() => {
    const tokenName = stablecoinName.trim() || 'Private stablecoin';
    return `${tokenName}: check your private balance, transfer notes, and register senders for private note discovery.`;
  }, [stablecoinName]);

  const loadStablecoinData = useCallback(
    async (isManualRefresh = false) => {
      if (!connectedAddress || !isStablecoinConfigured) {
        setStablecoinName('Private stablecoin');
        setPrivateBalance(null);
        setStablecoinLoadError(null);
        setIsStablecoinLoading(false);
        setIsStablecoinRefreshing(false);
        return;
      }

      if (!isStablecoinReady) {
        setIsStablecoinLoading(true);
        setIsStablecoinRefreshing(false);
        return;
      }

      if (isManualRefresh) {
        setIsStablecoinRefreshing(true);
      } else {
        setIsStablecoinLoading(true);
      }
      setStablecoinLoadError(null);

      try {
        const nameResult = await readContract({
          contract: PrivateStablecoinContract,
          address: stablecoinAddress,
          functionName: 'name',
          args: [],
        });
        if (!nameResult.success) {
          throw new Error(nameResult.error ?? 'Failed to load token name');
        }

        const balanceResult = await readContract({
          contract: PrivateStablecoinContract,
          address: stablecoinAddress,
          functionName: 'balance_of_private',
          args: [connectedAddress],
        });
        if (!balanceResult.success) {
          throw new Error(
            balanceResult.error ?? 'Failed to load private token balance'
          );
        }

        setStablecoinName(
          formatReadResult(nameResult.data) || 'Private stablecoin'
        );
        setPrivateBalance(BigInt(formatReadResult(balanceResult.data) || '0'));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown stablecoin error';
        setStablecoinLoadError(message);
        if (isManualRefresh) {
          toastError('Stablecoin refresh failed', message);
        }
      } finally {
        setIsStablecoinLoading(false);
        setIsStablecoinRefreshing(false);
      }
    },
    [
      connectedAddress,
      isStablecoinReady,
      isStablecoinConfigured,
      readContract,
      stablecoinAddress,
      toastError,
    ]
  );

  useEffect(() => {
    if (!isAnyWalletConnected || !isPXEInitialized) {
      setIsStablecoinLoading(true);
      return;
    }

    void loadStablecoinData(false);
  }, [isAnyWalletConnected, isPXEInitialized, loadStablecoinData]);

  useEffect(() => {
    if (!isStablecoinConfigured) {
      setIsStablecoinLoading(false);
      return;
    }

    if (failedContracts.includes('privateStablecoin')) {
      setIsStablecoinLoading(false);
    }
  }, [failedContracts, isStablecoinConfigured]);

  const handleBridgeClaim = useCallback(async () => {
    if (!isBridgeReady || !isBridgeConfigured || !bridgeClaimRecipient.trim()) {
      return;
    }

    const amount = parseField(bridgeClaimAmount);
    const secret = parseField(bridgeClaimSecret);
    const leafIndex = parseField(bridgeClaimLeafIndex);

    if (amount === null || secret === null || leafIndex === null) {
      toastError(
        'Invalid bridge claim fields',
        'amount, secret, and message leaf index must be non-negative integers'
      );
      return;
    }

    try {
      const result = await writeContract({
        contract: TokenBridgeContract,
        address: bridgeAddress,
        functionName: 'claim_private',
        args: [bridgeClaimRecipient.trim(), amount, secret, leafIndex],
        feePaymentMethod,
      });

      if (!result.success) {
        toastError('Bridge claim failed', result.error ?? 'Unknown error');
        return;
      }

      success('Deposit claimed', bridgeClaimRecipient.trim());
      setBridgeClaimRecipient('');
      setBridgeClaimAmount('');
      setBridgeClaimSecret('');
      setBridgeClaimLeafIndex('');
      await loadStablecoinData(true);
    } catch (error) {
      toastError(
        'Bridge claim failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }, [
    bridgeAddress,
    bridgeClaimAmount,
    bridgeClaimLeafIndex,
    bridgeClaimRecipient,
    bridgeClaimSecret,
    feePaymentMethod,
    isBridgeReady,
    isBridgeConfigured,
    loadStablecoinData,
    success,
    toastError,
    writeContract,
  ]);

  const handlePrepareWithdrawal = useCallback(async () => {
    if (
      !isBridgeReady ||
      !isBridgeConfigured ||
      !bridgeWithdrawalRecipient.trim()
    ) {
      return;
    }

    const amount = parseField(bridgeWithdrawalAmount);
    if (amount === null) {
      toastError(
        'Invalid withdrawal amount',
        'amount must be a non-negative integer'
      );
      return;
    }

    try {
      const recipient = bridgeWithdrawalRecipient.trim();
      const result = await writeContract({
        contract: TokenBridgeContract,
        address: bridgeAddress,
        functionName: 'exit_to_l1_private',
        args: [recipient, amount, recipient, ZERO_FIELD],
        feePaymentMethod,
      });

      if (!result.success) {
        toastError(
          'Withdrawal preparation failed',
          result.error ?? 'Unknown error'
        );
        return;
      }

      success('Withdrawal prepared', recipient);
      setBridgeWithdrawalRecipient('');
      setBridgeWithdrawalAmount('');
      await loadStablecoinData(true);
    } catch (error) {
      toastError(
        'Withdrawal preparation failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }, [
    bridgeAddress,
    bridgeWithdrawalAmount,
    bridgeWithdrawalRecipient,
    feePaymentMethod,
    isBridgeReady,
    isBridgeConfigured,
    loadStablecoinData,
    success,
    toastError,
    writeContract,
  ]);

  const handleTransfer = useCallback(async () => {
    if (
      !isStablecoinReady ||
      !isStablecoinConfigured ||
      !connectedAddress ||
      !stablecoinTransferTo.trim()
    ) {
      return;
    }

    const amount = parseField(stablecoinTransferAmount);
    if (amount === null) {
      toastError(
        'Invalid transfer amount',
        'amount must be a non-negative integer'
      );
      return;
    }

    try {
      const result = await writeContract({
        contract: PrivateStablecoinContract,
        address: stablecoinAddress,
        functionName: 'transfer_private_to_private',
        args: [
          connectedAddress,
          stablecoinTransferTo.trim(),
          amount,
          ZERO_FIELD,
        ],
        feePaymentMethod,
      });

      if (!result.success) {
        toastError('Transfer failed', result.error ?? 'Unknown error');
        return;
      }

      success('Transfer submitted', stablecoinTransferTo.trim());
      setStablecoinTransferTo('');
      setStablecoinTransferAmount('');
      await loadStablecoinData(true);
    } catch (error) {
      toastError(
        'Transfer failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }, [
    connectedAddress,
    feePaymentMethod,
    isStablecoinReady,
    isStablecoinConfigured,
    loadStablecoinData,
    stablecoinAddress,
    stablecoinTransferAmount,
    stablecoinTransferTo,
    success,
    toastError,
    writeContract,
  ]);

  const handleDiscoverSender = useCallback(async () => {
    if (
      !discoverSenderAddress.trim() ||
      !connector ||
      !currentConfig ||
      !hasAppManagedPXE(connector)
    ) {
      toastError(
        'Sender registration unavailable',
        'Connect with an embedded or external signer wallet to register senders'
      );
      return;
    }

    const pxeInstance = SharedPXEService.getExistingInstance(
      currentConfig.nodeUrl,
      currentConfig.name
    );

    if (!pxeInstance) {
      toastError(
        'PXE unavailable',
        'Reconnect the wallet or wait for PXE initialization to finish'
      );
      return;
    }

    try {
      await registerAddressAsSender(
        pxeInstance,
        discoverSenderAddress.trim(),
        'stablecoin:discoverSender'
      );
      success('Sender registered', discoverSenderAddress.trim());
      setDiscoverSenderAddress('');
      await loadStablecoinData(true);
    } catch (error) {
      toastError(
        'Sender registration failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }, [
    connector,
    currentConfig,
    discoverSenderAddress,
    loadStablecoinData,
    success,
    toastError,
  ]);

  if (!isAnyWalletConnected || !isPXEInitialized) {
    return null;
  }

  return (
    <Card>
      <CardHeader className={styles.headerRow}>
        <Landmark size={iconSize('xl')} className={styles.headerIcon} />
        <div>
          <CardTitle>Stablecoin</CardTitle>
          <CardDescription>
            Interact with the private stablecoin and its bridge contract.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className={styles.content}>
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Token bridge</h3>
            <p className={styles.sectionDescription}>
              Claim a private bridge deposit or prepare a private withdrawal to
              L1.
            </p>
          </div>

          {!isBridgeConfigured && (
            <div className={styles.sectionUnavailable}>
              Token bridge address is not configured for this network yet.
            </div>
          )}

          {isBridgeConfigured && (
            <>
              {contractsLoading && pendingContracts.includes('tokenBridge') && (
                <div className={styles.loadingContainer}>
                  <div className={styles.loadingSpinner} />
                  <p>Registering bridge contract with PXE...</p>
                </div>
              )}
              {contractsHasError && failedContracts.includes('tokenBridge') && (
                <div className={styles.sectionUnavailable}>
                  Failed to register the token bridge with PXE.
                </div>
              )}
              <div className={styles.formGroup}>
                <Input
                  label="Claim recipient"
                  value={bridgeClaimRecipient}
                  onChange={(event) =>
                    setBridgeClaimRecipient(event.target.value)
                  }
                  placeholder="0x..."
                  disabled={writePending || isWalletBusy}
                />
              </div>
              <div className={styles.row}>
                <Input
                  label="Amount"
                  value={bridgeClaimAmount}
                  onChange={(event) => setBridgeClaimAmount(event.target.value)}
                  placeholder="0"
                  disabled={writePending || isWalletBusy}
                  className={styles.inputFlex}
                />
                <Input
                  label="Claim secret"
                  value={bridgeClaimSecret}
                  onChange={(event) => setBridgeClaimSecret(event.target.value)}
                  placeholder="0"
                  disabled={writePending || isWalletBusy}
                  className={styles.inputFlex}
                />
                <Input
                  label="Message leaf index"
                  value={bridgeClaimLeafIndex}
                  onChange={(event) =>
                    setBridgeClaimLeafIndex(event.target.value)
                  }
                  placeholder="0"
                  disabled={writePending || isWalletBusy}
                  className={styles.inputFlex}
                />
              </div>
              <Button
                variant="primary"
                onClick={handleBridgeClaim}
                disabled={
                  !bridgeClaimRecipient.trim() ||
                  !bridgeClaimAmount.trim() ||
                  !bridgeClaimSecret.trim() ||
                  !bridgeClaimLeafIndex.trim() ||
                  !isBridgeReady ||
                  writePending ||
                  isWalletBusy
                }
                isLoading={writePending}
              >
                Claim deposit
              </Button>

              <div className={styles.formGroup}>
                <Input
                  label="Withdrawal recipient (L1)"
                  value={bridgeWithdrawalRecipient}
                  onChange={(event) =>
                    setBridgeWithdrawalRecipient(event.target.value)
                  }
                  placeholder="0x..."
                  disabled={writePending || isWalletBusy}
                />
              </div>
              <div className={styles.row}>
                <div className={cn(styles.formGroup, styles.inputFlex)}>
                  <Input
                    label="Withdrawal amount"
                    value={bridgeWithdrawalAmount}
                    onChange={(event) =>
                      setBridgeWithdrawalAmount(event.target.value)
                    }
                    placeholder="0"
                    disabled={writePending || isWalletBusy}
                  />
                </div>
                <Button
                  variant="secondary"
                  onClick={handlePrepareWithdrawal}
                  disabled={
                    !bridgeWithdrawalRecipient.trim() ||
                    !bridgeWithdrawalAmount.trim() ||
                    !isBridgeReady ||
                    writePending ||
                    isWalletBusy
                  }
                  isLoading={writePending}
                >
                  Prepare withdrawal
                </Button>
              </div>
              <p className={styles.sectionNote}>
                `caller_on_l1` reuses the recipient address and `authwit_nonce`
                is fixed to `0`.
              </p>
            </>
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Private stablecoin</h3>
            <p className={styles.sectionDescription}>{stablecoinDescription}</p>
          </div>

          {!isStablecoinConfigured && (
            <div className={styles.sectionUnavailable}>
              Private stablecoin address is not configured for this network yet.
            </div>
          )}

          {isStablecoinConfigured && (
            <>
              {contractsLoading &&
                pendingContracts.includes('privateStablecoin') && (
                  <div className={styles.loadingContainer}>
                    <div className={styles.loadingSpinner} />
                    <p>Registering private stablecoin contract with PXE...</p>
                  </div>
                )}
              {contractsHasError &&
                failedContracts.includes('privateStablecoin') && (
                  <div className={styles.sectionUnavailable}>
                    Failed to register the private stablecoin with PXE.
                  </div>
                )}
              <div className={styles.balancePanel}>
                <div className={styles.balanceHeader}>
                  <span className={styles.balanceTitle}>Private balance</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="icon"
                        size="icon"
                        onClick={() => {
                          void loadStablecoinData(true);
                        }}
                        disabled={
                          !isStablecoinReady ||
                          isStablecoinRefreshing ||
                          isWalletBusy
                        }
                        isLoading={isStablecoinRefreshing}
                        aria-label="Reload private stablecoin balance"
                      >
                        <RefreshCw size={iconSize()} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Reload private stablecoin balance
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className={styles.balanceValue}>
                  {isStablecoinLoading
                    ? 'Loading...'
                    : (privateBalance?.toString() ?? '0')}
                </div>
                <p className={styles.balanceHint}>
                  Connected account: {connectedAddress ?? 'Not connected'}
                </p>
                {stablecoinLoadError && (
                  <p className={styles.errorText}>{stablecoinLoadError}</p>
                )}
              </div>

              <div className={styles.row}>
                <Input
                  label="Transfer to"
                  value={stablecoinTransferTo}
                  onChange={(event) =>
                    setStablecoinTransferTo(event.target.value)
                  }
                  placeholder="0x..."
                  disabled={writePending || isWalletBusy}
                  className={styles.inputFlex}
                />
                <Input
                  label="Amount"
                  value={stablecoinTransferAmount}
                  onChange={(event) =>
                    setStablecoinTransferAmount(event.target.value)
                  }
                  placeholder="0"
                  disabled={writePending || isWalletBusy}
                  className={styles.inputFlex}
                />
              </div>
              <Button
                variant="primary"
                icon={<ArrowRightLeft size={iconSize()} />}
                onClick={handleTransfer}
                disabled={
                  !connectedAddress ||
                  !stablecoinTransferTo.trim() ||
                  !stablecoinTransferAmount.trim() ||
                  !isStablecoinReady ||
                  writePending ||
                  isWalletBusy
                }
                isLoading={writePending}
              >
                Transfer privately
              </Button>

              <div className={styles.row}>
                <Input
                  label="Discover notes from"
                  value={discoverSenderAddress}
                  onChange={(event) =>
                    setDiscoverSenderAddress(event.target.value)
                  }
                  placeholder="0x..."
                  helperText="Register an Aztec sender with PXE so incoming private notes from that address can be discovered."
                  disabled={writePending || isWalletBusy}
                  className={styles.inputFlex}
                />
                <Button
                  variant="secondary"
                  onClick={handleDiscoverSender}
                  disabled={
                    !discoverSenderAddress.trim() ||
                    writePending ||
                    isWalletBusy
                  }
                >
                  Register sender
                </Button>
              </div>

              {isStablecoinRefreshing && !isStablecoinLoading && (
                <p className={styles.inlineStatus}>
                  Refreshing token metadata and balance...
                </p>
              )}
            </>
          )}
        </section>
      </CardContent>
    </Card>
  );
};
