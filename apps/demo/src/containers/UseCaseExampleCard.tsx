import React, { useState, useCallback } from 'react';
import { Puzzle, AlertTriangle, CheckCircle } from 'lucide-react';
import { Contract } from '@aztec/aztec.js/contracts';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import type { AuthWitness } from '@aztec/stdlib/auth-witness';
import { useAztecWallet, hasAppManagedPXE } from '../aztec-wallet';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
} from '../components/ui';
import { useRequiredContracts } from '../hooks';
import { useWriteContract } from '../hooks/contracts';
import { useToast } from '../hooks';
import { contractsConfig } from '../config/contracts';
import { CertificateRegistryContract } from '../../../../artifacts/CertificateRegistry';
import { UseCaseExampleContract } from '../../../../artifacts/UseCaseExample';
import { iconSize } from '../utils';
import { useFeePayment } from '../store/feePayment';

const styles = {
  headerRow: 'flex flex-row items-start gap-4',
  headerIcon: 'text-accent',
  formContainer: 'space-y-6',
  section: 'space-y-4 rounded-lg border border-default bg-surface-secondary p-4',
  sectionTitle: 'text-sm font-semibold text-default mb-2',
  formGroup: 'space-y-2',
  label: 'block text-sm font-semibold text-default',
  row: 'flex flex-col gap-2 sm:flex-row sm:items-end',
  inputFlex: 'flex-1 min-w-0',
  loadingContainer:
    'flex flex-col items-center justify-center py-8 gap-4 text-muted',
  loadingSpinner:
    'animate-spin rounded-full h-8 w-8 border-2 border-current border-t-transparent',
  loadingText: 'text-sm',
  errorContainer: 'text-center py-6',
  errorIcon: 'text-amber-500 mx-auto mb-2',
  errorTitle: 'text-lg font-semibold text-default mb-1',
  errorText: 'text-sm text-muted',
  usePrivatelyButtonSuccess: 'bg-green-500 text-white hover:bg-green-600 border-0',
  helperText: 'text-sm text-muted mb-3',
} as const;

export const UseCaseExampleCard: React.FC = () => {
  const {
    account,
    isPXEInitialized,
    connectors,
    connector,
    currentConfig,
  } = useAztecWallet();
  const { success, error: toastError } = useToast();
  const { method: feePaymentMethod } = useFeePayment();

  const {
    isReady: contractsReady,
    isLoading: contractsLoading,
    hasError: contractsHasError,
    failedContracts,
    pendingContracts,
  } = useRequiredContracts(['useCaseExample'] as const);

  const { writeContract, isPending: writePending } = useWriteContract();

  const [usePrivatelyStatus, setUsePrivatelyStatus] = useState<
    'idle' | 'pending' | 'success'
  >('idle');

  const contractAddress = currentConfig
    ? contractsConfig.useCaseExample.address(currentConfig)
    : undefined;

  const isProcessing = writePending;
  const connectorStatus = connector?.getStatus().status;
  const isWalletBusy =
    connectorStatus === 'connecting' || connectorStatus === 'deploying';

  const handleUsePrivately = useCallback(async () => {
    if (!contractAddress || !account || !currentConfig) return;
    setUsePrivatelyStatus('pending');
    const nonce = Fr.random();
    const userAddress = account.getAddress();
    try {
      let authWitnesses: AuthWitness[] | undefined;
      if (connector && hasAppManagedPXE(connector)) {
        const wallet = connector.getWallet();
        if (wallet) {
          const certRegistryAddress = contractsConfig.certificateRegistry.address(
            currentConfig
          );
          const useCaseExampleAddress = AztecAddress.fromString(contractAddress);
          const certRegistry = await Contract.at(
            AztecAddress.fromString(certRegistryAddress),
            CertificateRegistryContract.artifact,
            wallet
          );
          const action = (
            certRegistry as unknown as {
              methods: {
                check_certificate_and_requirements: (
                  user: typeof userAddress,
                  authwitNonce: Fr,
                  checkerAddress: AztecAddress
                ) => unknown;
              };
            }
          ).methods.check_certificate_and_requirements(
            userAddress,
            nonce,
            AztecAddress.fromString(currentConfig.ageCheckRequirementContractAddress)
          );
          const intent = { caller: useCaseExampleAddress, action };
          const witness = await wallet.createAuthWit(
            userAddress,
            intent as unknown as Parameters<typeof wallet.createAuthWit>[1]
          );
          authWitnesses = [witness];
        }
      }
      const result = await writeContract({
        contract: UseCaseExampleContract,
        address: contractAddress,
        functionName: 'use_privately',
        args: [nonce],
        feePaymentMethod,
        authWitnesses,
      });
      if (result.success) {
        setUsePrivatelyStatus('success');
        success('Use case executed', 'use_privately completed successfully');
      } else {
        setUsePrivatelyStatus('idle');
        toastError('Failed', result.error ?? 'Unknown error');
      }
    } catch (err) {
      setUsePrivatelyStatus('idle');
      toastError('Failed', err instanceof Error ? err.message : 'Unknown error');
    }
  }, [
    contractAddress,
    account,
    connector,
    currentConfig,
    writeContract,
    feePaymentMethod,
    success,
    toastError,
  ]);

  const isAnyWalletConnected =
    Boolean(account) ||
    connectors.some((c) => c.getStatus().status === 'connected');
  const showForm = isAnyWalletConnected && isPXEInitialized;

  if (!showForm) {
    return null;
  }

  if (contractsHasError) {
    return (
      <Card>
        <CardContent className={styles.errorContainer}>
          <AlertTriangle size={iconSize('2xl')} className={styles.errorIcon} />
          <h3 className={styles.errorTitle}>Contract Registration Failed</h3>
          <p className={styles.errorText}>
            Failed to register: {failedContracts.join(', ')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className={styles.headerRow}>
        <Puzzle size={iconSize('xl')} className={styles.headerIcon} />
        <div>
          <CardTitle>Use Case Example</CardTitle>
          <CardDescription>
            Example contract that checks compliance via the ZK Certificate
            Registry. Call use_privately with a random authwit nonce and an auth
            witness for check_certificate_and_requirements.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className={styles.formContainer}>
        {contractsLoading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner} />
            <p className={styles.loadingText}>
              Loading contracts: {pendingContracts.join(', ')}...
            </p>
          </div>
        ) : (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>use_privately</h3>
            <p className={styles.helperText}>
              Private function that checks your certificate with the ZK
              Certificate Registry. Uses a random authwit nonce and an auth
              witness for check_certificate_and_requirements.
            </p>
            <Button
              variant={usePrivatelyStatus === 'success' ? 'secondary' : 'primary'}
              className={usePrivatelyStatus === 'success' ? styles.usePrivatelyButtonSuccess : undefined}
              icon={
                usePrivatelyStatus === 'success' ? (
                  <CheckCircle size={iconSize()} />
                ) : undefined
              }
              onClick={handleUsePrivately}
              disabled={
                isProcessing || isWalletBusy || !contractsReady
              }
              isLoading={isProcessing}
            >
              {usePrivatelyStatus === 'success'
                ? 'Completed'
                : 'Use privately'}
            </Button>
          </section>
        )}
      </CardContent>
    </Card>
  );
};
