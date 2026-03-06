import React, { useState, useCallback } from 'react';
import { Puzzle, AlertTriangle, CheckCircle } from 'lucide-react';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Contract } from '@aztec/aztec.js/contracts';
import { Fr } from '@aztec/aztec.js/fields';
import type { AuthWitness } from '@aztec/stdlib/auth-witness';
import { CertificateRegistryContract } from '../../../../artifacts/CertificateRegistry';
import { ShamirDisclosureContract } from '../../../../artifacts/ShamirDisclosure';
import { UseCaseExampleContract } from '../../../../artifacts/UseCaseExample';
import { useAztecWallet, hasAppManagedPXE } from '../aztec-wallet';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
} from '../components/ui';
import { contractsConfig } from '../config/contracts';
import { useRequiredContracts } from '../hooks';
import { useToast } from '../hooks';
import { useContractRegistry } from '../hooks/context';
import { useWriteContract } from '../hooks/contracts';
import { useFeePayment } from '../store/feePayment';
import { cn, iconSize } from '../utils';

const DISCLOSURE_CONTEXT = new Fr(777);
const ZERO_ADDRESS =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

type RequirementSelector = 'age-check' | 'sanction-list';
type DisclosureSelector = 'basic' | 'shamir';

const styles = {
  headerRow: 'flex flex-row items-start gap-4',
  headerIcon: 'text-accent',
  formContainer: 'space-y-6',
  section:
    'space-y-4 rounded-lg border border-default bg-surface-secondary p-4',
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
  usePrivatelyButtonSuccess:
    'bg-green-500 text-white hover:bg-green-600 border-0',
  helperText: 'text-sm text-muted mb-3',
  optionGroup: 'space-y-2',
  optionGroupTitle: 'text-sm font-semibold text-default',
  optionList: 'grid gap-2',
  optionLabel:
    'flex items-start gap-2 rounded-md border border-default bg-surface px-3 py-2 text-sm text-default',
  optionLabelDisabled: 'opacity-50 cursor-not-allowed',
  radioInput: 'mt-0.5',
  optionContent: 'flex flex-col gap-1',
  optionTitle: 'font-medium text-default',
  optionAddress: 'font-mono text-xs text-muted break-all',
  demoButtonSuccess: 'bg-green-500 text-white hover:bg-green-600 border-0',
} as const;

export const UseCaseExampleCard: React.FC = () => {
  const { account, isPXEInitialized, connectors, connector, currentConfig } =
    useAztecWallet();
  const { success, error: toastError } = useToast();
  const { method: feePaymentMethod } = useFeePayment();
  const { register } = useContractRegistry();

  const {
    isReady: contractsReady,
    isLoading: contractsLoading,
    hasError: contractsHasError,
    failedContracts,
    pendingContracts,
  } = useRequiredContracts(['useCaseExample', 'ageCheckRequirement'] as const);

  const { writeContract, isPending: writePending } = useWriteContract();

  const [usePrivatelyStatus, setUsePrivatelyStatus] = useState<
    'idle' | 'pending' | 'success'
  >('idle');
  const [demoCustomStatus, setDemoCustomStatus] = useState<
    'idle' | 'pending' | 'success'
  >('idle');
  const [selectedRequirement, setSelectedRequirement] =
    useState<RequirementSelector>('age-check');
  const [selectedDisclosure, setSelectedDisclosure] =
    useState<DisclosureSelector>('basic');

  const contractAddress = currentConfig
    ? contractsConfig.useCaseExample.address(currentConfig)
    : undefined;

  const isProcessing = writePending;
  const connectorStatus = connector?.getStatus().status;
  const isWalletBusy =
    connectorStatus === 'connecting' || connectorStatus === 'deploying';

  const ageCheckAddress = currentConfig?.ageCheckRequirementContractAddress;
  const sanctionListAddress =
    currentConfig?.sanctionListRequirementContractAddress;
  const basicDisclosureAddress = currentConfig?.basicDisclosureContractAddress;
  const shamirDisclosureAddress =
    currentConfig?.shamirDisclosureContractAddress;

  const selectedRequirementAddress =
    selectedRequirement === 'age-check' ? ageCheckAddress : sanctionListAddress;
  const selectedDisclosureAddress =
    selectedDisclosure === 'basic'
      ? basicDisclosureAddress
      : shamirDisclosureAddress;

  const isAddressMissing = (address?: string) =>
    !address || address === ZERO_ADDRESS;

  const selectedConfigValid =
    !isAddressMissing(selectedRequirementAddress) &&
    !isAddressMissing(selectedDisclosureAddress);

  const createCertificateCheckAuthWitness = useCallback(
    async (
      nonce: Fr,
      requirementCheckerAddress: string,
      disclosureAddress: string
    ): Promise<AuthWitness[] | undefined> => {
      if (
        !account ||
        !contractAddress ||
        !currentConfig ||
        !connector ||
        !hasAppManagedPXE(connector)
      ) {
        return undefined;
      }

      const wallet = connector.getWallet();
      if (!wallet) return undefined;

      const userAddress = account.getAddress();
      const certRegistryAddress =
        contractsConfig.certificateRegistry.address(currentConfig);
      const useCaseExampleAddress = AztecAddress.fromString(contractAddress);
      const certRegistry = await Contract.at(
        AztecAddress.fromString(certRegistryAddress),
        CertificateRegistryContract.artifact,
        wallet
      );
      const action = (
        certRegistry as unknown as {
          methods: {
            check_certificate: (
              _user: typeof userAddress,
              _authwitNonce: Fr,
              _requirementChecker: AztecAddress,
              _disclosureContract: AztecAddress,
              _disclosureContext: Fr
            ) => unknown;
          };
        }
      ).methods.check_certificate(
        userAddress,
        nonce,
        AztecAddress.fromString(requirementCheckerAddress),
        AztecAddress.fromString(disclosureAddress),
        DISCLOSURE_CONTEXT
      );
      const intent = { caller: useCaseExampleAddress, action };
      const witness = await wallet.createAuthWit(
        userAddress,
        intent as unknown as Parameters<typeof wallet.createAuthWit>[1]
      );
      return [witness];
    },
    [account, connector, contractAddress, currentConfig]
  );

  const ensureShamirDisclosureRegistered = useCallback(
    async (address: string) => {
      if (
        !connector ||
        !hasAppManagedPXE(connector) ||
        !currentConfig ||
        isAddressMissing(address)
      ) {
        return;
      }

      const pxe = connector.getPXE();
      if (!pxe) return;

      const expectedAddress = AztecAddress.fromString(address);

      try {
        const existing = await pxe.getContractInstance(expectedAddress);
        if (existing) return;
      } catch {
        // Continue with registration attempt.
      }

      const { getContractInstanceFromInstantiationParams } = await import(
        '@aztec/aztec.js/contracts'
      );

      const constructorArgs = currentConfig.shamirDisclosureConstructorArgs;
      const hasConstructorData =
        constructorArgs.recipientCount > 0 &&
        constructorArgs.threshold > 0 &&
        constructorArgs.recipients.every((v) => !isAddressMissing(v)) &&
        constructorArgs.participantAddresses.every((v) => !isAddressMissing(v));
      if (!hasConstructorData) {
        throw new Error(
          'Missing Shamir constructor metadata in sandbox deployment. Re-run `yarn deploy` from repo root so the frontend can register the deployed Shamir contract.'
        );
      }

      const deployerAddress = AztecAddress.fromString(
        currentConfig.deployerAddress
      );

      const instance = await getContractInstanceFromInstantiationParams(
        ShamirDisclosureContract.artifact,
        {
          salt: Fr.fromString(currentConfig.shamirDisclosureDeploymentSalt),
          deployer: deployerAddress,
          constructorArgs: [
            constructorArgs.recipientCount,
            constructorArgs.threshold,
            ...constructorArgs.recipients.map((value) =>
              AztecAddress.fromString(value)
            ),
            ...constructorArgs.participantAddresses.map((value) =>
              AztecAddress.fromString(value)
            ),
          ],
          constructorArtifact: 'constructor',
        }
      );

      if (!instance.address.equals(expectedAddress)) {
        throw new Error(
          `Shamir constructor mismatch. Computed ${instance.address.toString()} but deployment expects ${expectedAddress.toString()}. Re-run \`yarn deploy\` to refresh sandbox deployment metadata.`
        );
      }

      await pxe.registerContract({
        instance,
        artifact: ShamirDisclosureContract.artifact,
      });
    },
    [connector, currentConfig]
  );

  const handleUsePrivately = useCallback(async () => {
    if (!contractAddress || !account || !currentConfig) return;
    setUsePrivatelyStatus('pending');
    const nonce = Fr.random();
    try {
      const authWitnesses = await createCertificateCheckAuthWitness(
        nonce,
        currentConfig.ageCheckRequirementContractAddress,
        currentConfig.basicDisclosureContractAddress
      );
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
      toastError(
        'Failed',
        err instanceof Error ? err.message : 'Unknown error'
      );
    }
  }, [
    account,
    contractAddress,
    currentConfig,
    writeContract,
    feePaymentMethod,
    createCertificateCheckAuthWitness,
    success,
    toastError,
  ]);

  const handleDemoCustomContracts = useCallback(async () => {
    if (
      !contractAddress ||
      !selectedRequirementAddress ||
      !selectedDisclosureAddress ||
      isAddressMissing(selectedRequirementAddress) ||
      isAddressMissing(selectedDisclosureAddress)
    ) {
      toastError(
        'Missing address',
        'Selected requirement/disclosure address is not configured'
      );
      return;
    }

    setDemoCustomStatus('pending');
    const nonce = Fr.random();

    try {
      if (selectedRequirement === 'sanction-list') {
        await register('sanctionListRequirement');
      }
      if (selectedDisclosure === 'shamir') {
        await ensureShamirDisclosureRegistered(selectedDisclosureAddress);
      }

      const authWitnesses = await createCertificateCheckAuthWitness(
        nonce,
        selectedRequirementAddress,
        selectedDisclosureAddress
      );
      const result = await writeContract({
        contract: UseCaseExampleContract,
        address: contractAddress,
        functionName: 'demo_custom_contracts' as never,
        args: [
          nonce,
          selectedRequirementAddress,
          selectedDisclosureAddress,
        ] as never,
        feePaymentMethod,
        authWitnesses,
      });
      if (result.success) {
        setDemoCustomStatus('success');
        success(
          'Demo custom contracts executed',
          'demo_custom_contracts completed successfully'
        );
      } else {
        setDemoCustomStatus('idle');
        toastError('Failed', result.error ?? 'Unknown error');
      }
    } catch (err) {
      setDemoCustomStatus('idle');
      toastError(
        'Failed',
        err instanceof Error ? err.message : 'Unknown error'
      );
    }
  }, [
    contractAddress,
    selectedRequirementAddress,
    selectedDisclosureAddress,
    writeContract,
    feePaymentMethod,
    createCertificateCheckAuthWitness,
    ensureShamirDisclosureRegistered,
    register,
    selectedDisclosure,
    selectedRequirement,
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
            witness for check_certificate.
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
          <>
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>use_privately</h3>
              <p className={styles.helperText}>
                Private function that checks your certificate with the ZK
                Certificate Registry. Uses a random authwit nonce and an auth
                witness for check_certificate.
              </p>
              <Button
                variant={
                  usePrivatelyStatus === 'success' ? 'secondary' : 'primary'
                }
                className={
                  usePrivatelyStatus === 'success'
                    ? styles.usePrivatelyButtonSuccess
                    : undefined
                }
                icon={
                  usePrivatelyStatus === 'success' ? (
                    <CheckCircle size={iconSize()} />
                  ) : undefined
                }
                onClick={handleUsePrivately}
                disabled={isProcessing || isWalletBusy || !contractsReady}
                isLoading={isProcessing}
              >
                {usePrivatelyStatus === 'success'
                  ? 'Completed'
                  : 'Use privately'}
              </Button>
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>demo_custom_contracts</h3>
              <p className={styles.helperText}>
                Private function that checks your certificate using selected
                requirement and disclosure contract addresses from Settings.
              </p>

              <div className={styles.optionGroup}>
                <h4 className={styles.optionGroupTitle}>Requirement checker</h4>
                <div className={styles.optionList}>
                  <label className={styles.optionLabel}>
                    <input
                      className={styles.radioInput}
                      type="radio"
                      name="requirement-checker"
                      checked={selectedRequirement === 'age-check'}
                      onChange={() => setSelectedRequirement('age-check')}
                    />
                    <span className={styles.optionContent}>
                      <span className={styles.optionTitle}>Age Check</span>
                      <span className={styles.optionAddress}>
                        {ageCheckAddress}
                      </span>
                    </span>
                  </label>
                  <label
                    className={cn(
                      styles.optionLabel,
                      isAddressMissing(sanctionListAddress) &&
                        styles.optionLabelDisabled
                    )}
                  >
                    <input
                      className={styles.radioInput}
                      type="radio"
                      name="requirement-checker"
                      checked={selectedRequirement === 'sanction-list'}
                      onChange={() => setSelectedRequirement('sanction-list')}
                      disabled={isAddressMissing(sanctionListAddress)}
                    />
                    <span className={styles.optionContent}>
                      <span className={styles.optionTitle}>Sanction List</span>
                      <span className={styles.optionAddress}>
                        {sanctionListAddress ?? ZERO_ADDRESS}
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <div className={styles.optionGroup}>
                <h4 className={styles.optionGroupTitle}>Disclosure</h4>
                <div className={styles.optionList}>
                  <label className={styles.optionLabel}>
                    <input
                      className={styles.radioInput}
                      type="radio"
                      name="disclosure-contract"
                      checked={selectedDisclosure === 'basic'}
                      onChange={() => setSelectedDisclosure('basic')}
                    />
                    <span className={styles.optionContent}>
                      <span className={styles.optionTitle}>
                        Basic direct disclosure
                      </span>
                      <span className={styles.optionAddress}>
                        {basicDisclosureAddress}
                      </span>
                    </span>
                  </label>
                  <label className={styles.optionLabel}>
                    <input
                      className={styles.radioInput}
                      type="radio"
                      name="disclosure-contract"
                      checked={selectedDisclosure === 'shamir'}
                      onChange={() => setSelectedDisclosure('shamir')}
                    />
                    <span className={styles.optionContent}>
                      <span className={styles.optionTitle}>
                        Shamir secret sharing
                      </span>
                      <span className={styles.optionAddress}>
                        {shamirDisclosureAddress}
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <Button
                variant={
                  demoCustomStatus === 'success' ? 'secondary' : 'primary'
                }
                className={
                  demoCustomStatus === 'success'
                    ? styles.demoButtonSuccess
                    : undefined
                }
                icon={
                  demoCustomStatus === 'success' ? (
                    <CheckCircle size={iconSize()} />
                  ) : undefined
                }
                onClick={handleDemoCustomContracts}
                disabled={
                  isProcessing ||
                  isWalletBusy ||
                  !contractsReady ||
                  !selectedConfigValid
                }
                isLoading={isProcessing || demoCustomStatus === 'pending'}
              >
                {demoCustomStatus === 'success'
                  ? 'Completed'
                  : 'Run custom demo'}
              </Button>
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
};
