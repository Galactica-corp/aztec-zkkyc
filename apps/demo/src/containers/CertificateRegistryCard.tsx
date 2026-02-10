import React, { useState, useCallback } from 'react';
import { FileCheck, AlertTriangle, Shield, RefreshCw, CheckCircle } from 'lucide-react';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { useAztecWallet } from '../aztec-wallet';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Input,
  Button,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '../components/ui';
import { useRequiredContracts, useCertificates } from '../hooks';
import { useWriteContract, useReadContract } from '../hooks/contracts';
import { useToast } from '../hooks';
import { contractsConfig } from '../config/contracts';
import { CertificateRegistryContract } from '../../../../artifacts/CertificateRegistry';
import { cn, iconSize, truncateAddress } from '../utils';
import { useFeePayment } from '../store/feePayment';

const styles = {
  headerRow: 'flex flex-row items-start gap-4',
  headerIcon: 'text-accent',
  formContainer: 'space-y-6',
  // My certificates section (top)
  certificatesSection: 'rounded-xl border border-default bg-surface-secondary shadow-theme p-4 mb-4',
  certificatesSectionHeader: 'flex items-center justify-between gap-2 pb-3',
  certificatesSectionTitle: 'flex items-center gap-2 text-base font-semibold text-default',
  certificatesSectionTitleIcon: 'text-accent',
  certificatesReloadButton: 'shrink-0',
  certificatesFetchingBadge: 'ml-1 inline-block',
  certificatesLoading: 'flex items-center justify-center gap-3 py-6 text-muted',
  certificatesLoadingSpinner:
    'animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent',
  certificatesList: 'space-y-3',
  certificateCard:
    'rounded-lg border border-default bg-surface-tertiary p-3 space-y-2',
  certificateRow: 'flex flex-wrap items-center gap-x-2 gap-y-1 text-sm',
  certificateLabel: 'text-muted shrink-0',
  certificateValue: 'font-mono text-default break-all',
  certificateEmpty: 'py-4 text-center text-sm text-muted',
  // Form sections
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
  checkHelper: 'text-sm text-muted mb-2',
  checkButtonSuccess: 'bg-green-500 text-white hover:bg-green-600 border-0',
} as const;

export const CertificateRegistryCard: React.FC = () => {
  const { account, address: connectedAddress, isPXEInitialized, connectors, connector, currentConfig } =
    useAztecWallet();
  const { success, error: toastError, loading } = useToast();
  const { method: feePaymentMethod } = useFeePayment();

  const {
    isReady: contractsReady,
    isLoading: contractsLoading,
    hasError: contractsHasError,
    failedContracts,
    pendingContracts,
  } = useRequiredContracts(['certificateRegistry'] as const);

  const { writeContract, isPending: writePending } = useWriteContract();
  const { readContract, isPending: readPending } = useReadContract();
  const {
    certificates,
    isLoading: certificatesLoading,
    isFetching: certificatesFetching,
    refetch: refetchCertificates,
  } = useCertificates({
    enabled: Boolean(
      (Boolean(account) ||
        connectors.some((c) => c.getStatus().status === 'connected')) &&
        isPXEInitialized
    ),
  });

  const registryAddress = currentConfig
    ? contractsConfig.certificateRegistry.address(currentConfig)
    : undefined;

  // Form state: whitelist_guardian / remove_guardian_from_whitelist
  const [guardianAddress, setGuardianAddress] = useState('');

  // Form state: issue_certificate
  const [issueUser, setIssueUser] = useState('');
  const [issueUniqueId, setIssueUniqueId] = useState('');
  const [issueRevocationId, setIssueRevocationId] = useState('');

  // Form state: revoke_certificate
  const [revokeRevocationId, setRevokeRevocationId] = useState('');

  // Form state: get_certificate_count
  const [countOwner, setCountOwner] = useState('');
  const [certificateCount, setCertificateCount] = useState<number | null>(null);

  // Form state: check_certificate (uses connected account + authwit_nonce 0)
  const [checkCertificateStatus, setCheckCertificateStatus] = useState<
    'idle' | 'pending' | 'success'
  >('idle');

  // Form state: cancel_authwit
  const [cancelInnerHash, setCancelInnerHash] = useState('');

  const isProcessing = writePending || readPending;
  const connectorStatus = connector?.getStatus().status;
  const isWalletBusy =
    connectorStatus === 'connecting' || connectorStatus === 'deploying';

  const parseField = (value: string): bigint | null => {
    if (value.trim() === '') return null;
    try {
      const n = BigInt(value);
      if (n < 0n) return null;
      return n;
    } catch {
      return null;
    }
  };

  const handleWhitelistGuardian = useCallback(async () => {
    if (!registryAddress || !guardianAddress.trim()) return;
    try {
      const result = await writeContract({
        contract: CertificateRegistryContract,
        address: registryAddress,
        functionName: 'whitelist_guardian',
        args: [AztecAddress.fromString(guardianAddress.trim())],
        feePaymentMethod,
      });
      if (result.success) {
        success('Guardian whitelisted', guardianAddress);
        setGuardianAddress('');
      } else {
        toastError('Failed', result.error ?? 'Unknown error');
      }
    } catch (err) {
      toastError('Failed', err instanceof Error ? err.message : 'Unknown error');
    }
  }, [
    registryAddress,
    guardianAddress,
    writeContract,
    feePaymentMethod,
    success,
    toastError,
  ]);

  const handleRemoveGuardian = useCallback(async () => {
    if (!registryAddress || !guardianAddress.trim()) return;
    try {
      const result = await writeContract({
        contract: CertificateRegistryContract,
        address: registryAddress,
        functionName: 'remove_guardian_from_whitelist',
        args: [AztecAddress.fromString(guardianAddress.trim())],
        feePaymentMethod,
      });
      if (result.success) {
        success('Guardian removed from whitelist', guardianAddress);
        setGuardianAddress('');
      } else {
        toastError('Failed', result.error ?? 'Unknown error');
      }
    } catch (err) {
      toastError('Failed', err instanceof Error ? err.message : 'Unknown error');
    }
  }, [
    registryAddress,
    guardianAddress,
    writeContract,
    feePaymentMethod,
    success,
    toastError,
  ]);

  const handleIssueCertificate = useCallback(async () => {
    if (!registryAddress || !issueUser.trim()) return;
    const uniqueId = parseField(issueUniqueId);
    const revocationId = parseField(issueRevocationId);
    if (uniqueId === null || revocationId === null) {
      toastError('Invalid fields', 'unique_id and revocation_id must be non-negative integers');
      return;
    }
    try {
      const result = await writeContract({
        contract: CertificateRegistryContract,
        address: registryAddress,
        functionName: 'issue_certificate',
        args: [
          AztecAddress.fromString(issueUser.trim()),
          uniqueId,
          revocationId,
        ],
        feePaymentMethod,
      });
      if (result.success) {
        success('Certificate issued', `To ${issueUser}`);
        setIssueUser('');
        setIssueUniqueId('');
        setIssueRevocationId('');
      } else {
        toastError('Failed', result.error ?? 'Unknown error');
      }
    } catch (err) {
      toastError('Failed', err instanceof Error ? err.message : 'Unknown error');
    }
  }, [
    registryAddress,
    issueUser,
    issueUniqueId,
    issueRevocationId,
    writeContract,
    feePaymentMethod,
    success,
    toastError,
  ]);

  const handleRevokeCertificate = useCallback(async () => {
    if (!registryAddress) return;
    const revocationId = parseField(revokeRevocationId);
    if (revocationId === null) {
      toastError('Invalid field', 'revocation_id must be a non-negative integer');
      return;
    }
    try {
      const result = await writeContract({
        contract: CertificateRegistryContract,
        address: registryAddress,
        functionName: 'revoke_certificate',
        args: [revocationId],
        feePaymentMethod,
      });
      if (result.success) {
        success('Certificate revoked', `revocation_id ${revokeRevocationId}`);
        setRevokeRevocationId('');
      } else {
        toastError('Failed', result.error ?? 'Unknown error');
      }
    } catch (err) {
      toastError('Failed', err instanceof Error ? err.message : 'Unknown error');
    }
  }, [
    registryAddress,
    revokeRevocationId,
    writeContract,
    feePaymentMethod,
    success,
    toastError,
  ]);

  const handleGetCertificateCount = useCallback(async () => {
    if (!registryAddress || !countOwner.trim()) return;
    try {
      const result = await readContract({
        contract: CertificateRegistryContract,
        address: registryAddress,
        functionName: 'get_certificate_count',
        args: [AztecAddress.fromString(countOwner.trim())],
      });
      if (result.success && result.data !== undefined) {
        setCertificateCount(Number(result.data));
        success('Count loaded', `${result.data} certificate(s)`);
      } else {
        toastError('Failed', result.error ?? 'Unknown error');
      }
    } catch (err) {
      toastError('Failed', err instanceof Error ? err.message : 'Unknown error');
    }
  }, [registryAddress, countOwner, readContract, success, toastError]);

  const handleCheckCertificate = useCallback(async () => {
    if (!registryAddress || !connectedAddress) return;
    setCheckCertificateStatus('pending');
    try {
      const result = await writeContract({
        contract: CertificateRegistryContract,
        address: registryAddress,
        functionName: 'check_certificate',
        args: [AztecAddress.fromString(connectedAddress), 0n],
        feePaymentMethod,
      });
      if (result.success) {
        setCheckCertificateStatus('success');
        success('Certificate checked', 'Valid certificate');
      } else {
        setCheckCertificateStatus('idle');
        toastError('Failed', result.error ?? 'Unknown error');
      }
    } catch (err) {
      setCheckCertificateStatus('idle');
      toastError('Failed', err instanceof Error ? err.message : 'Unknown error');
    }
  }, [
    registryAddress,
    connectedAddress,
    writeContract,
    feePaymentMethod,
    success,
    toastError,
  ]);

  const handleCancelAuthwit = useCallback(async () => {
    if (!registryAddress) return;
    const innerHash = parseField(cancelInnerHash);
    if (innerHash === null) {
      toastError('Invalid field', 'inner_hash must be a non-negative integer');
      return;
    }
    try {
      const result = await writeContract({
        contract: CertificateRegistryContract,
        address: registryAddress,
        functionName: 'cancel_authwit',
        args: [innerHash],
        feePaymentMethod,
      });
      if (result.success) {
        success('Authwit cancelled', 'inner_hash cancelled');
        setCancelInnerHash('');
      } else {
        toastError('Failed', result.error ?? 'Unknown error');
      }
    } catch (err) {
      toastError('Failed', err instanceof Error ? err.message : 'Unknown error');
    }
  }, [
    registryAddress,
    cancelInnerHash,
    writeContract,
    feePaymentMethod,
    success,
    toastError,
  ]);

  const isAnyWalletConnected =
    Boolean(account) ||
    connectors.some((conn) => conn.getStatus().status === 'connected');
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
        <FileCheck size={iconSize('xl')} className={styles.headerIcon} />
        <div>
          <CardTitle>Certificate Registry</CardTitle>
          <CardDescription>
            ZK KYC certificate registry: whitelist guardians, issue/revoke
            certificates, check certificates.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className={styles.formContainer}>
        {/* My certificates – at top, loads automatically */}
        {showForm && (
          <div
            className={styles.certificatesSection}
            data-testid="certificates-owned-section"
          >
            <div className={styles.certificatesSectionHeader}>
              <div className={styles.certificatesSectionTitle}>
                <Shield size={iconSize('md')} className={styles.certificatesSectionTitleIcon} />
                My certificates
                {certificatesFetching && !certificatesLoading && (
                  <span className={cn(styles.certificatesLoadingSpinner, styles.certificatesFetchingBadge)} />
                )}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="icon"
                    size="icon"
                    onClick={() => refetchCertificates()}
                    disabled={certificatesFetching || isWalletBusy}
                    isLoading={certificatesFetching}
                    className={styles.certificatesReloadButton}
                    aria-label="Reload certificates"
                  >
                    <RefreshCw size={iconSize()} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reload certificates</TooltipContent>
              </Tooltip>
            </div>
            {certificatesLoading ? (
              <div className={styles.certificatesLoading} data-testid="certificates-loading">
                <div className={styles.certificatesLoadingSpinner} />
                <span>Loading certificates...</span>
              </div>
            ) : certificates.length === 0 ? (
              <p className={styles.certificateEmpty}>
                No certificates yet. Get one issued by a whitelisted guardian.
              </p>
            ) : (
              <div className={styles.certificatesList}>
                {certificates.map((cert, index) => (
                  <div
                    key={`${cert.revocationId}-${index}`}
                    className={styles.certificateCard}
                    data-testid="certificate-card"
                  >
                    <div className={styles.certificateRow}>
                      <span className={styles.certificateLabel}>Owner:</span>
                      <span className={styles.certificateValue} title={cert.owner}>
                        {truncateAddress(cert.owner)}
                      </span>
                    </div>
                    <div className={styles.certificateRow}>
                      <span className={styles.certificateLabel}>Guardian:</span>
                      <span className={styles.certificateValue} title={cert.guardian}>
                        {truncateAddress(cert.guardian)}
                      </span>
                    </div>
                    <div className={styles.certificateRow}>
                      <span className={styles.certificateLabel}>Unique ID:</span>
                      <span className={styles.certificateValue}>{cert.uniqueId}</span>
                    </div>
                    <div className={styles.certificateRow}>
                      <span className={styles.certificateLabel}>Revocation ID:</span>
                      <span className={styles.certificateValue}>{cert.revocationId}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {contractsLoading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner} />
            <p className={styles.loadingText}>
              Loading contracts: {pendingContracts.join(', ')}...
            </p>
          </div>
        ) : (
          <>
            {/* Admin: whitelist / remove guardian */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Admin – Guardian whitelist</h3>
              <div className={styles.formGroup}>
                <label htmlFor="cert-guardian" className={styles.label}>
                  Guardian address
                </label>
                <div className={styles.row}>
                  <Input
                    id="cert-guardian"
                    value={guardianAddress}
                    onChange={(e) => setGuardianAddress(e.target.value)}
                    placeholder="0x..."
                    disabled={isProcessing || !contractsReady}
                    className={styles.inputFlex}
                  />
                  <Button
                    variant="primary"
                    onClick={handleWhitelistGuardian}
                    disabled={
                      !guardianAddress.trim() ||
                      isProcessing ||
                      isWalletBusy ||
                      !contractsReady
                    }
                    isLoading={isProcessing}
                  >
                    Whitelist
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleRemoveGuardian}
                    disabled={
                      !guardianAddress.trim() ||
                      isProcessing ||
                      isWalletBusy ||
                      !contractsReady
                    }
                    isLoading={isProcessing}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </section>

            {/* Guardian: issue_certificate */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Guardian – Issue certificate</h3>
              <div className={styles.formGroup}>
                <label htmlFor="cert-issue-user" className={styles.label}>
                  User address
                </label>
                <Input
                  id="cert-issue-user"
                  value={issueUser}
                  onChange={(e) => setIssueUser(e.target.value)}
                  placeholder="0x..."
                  disabled={isProcessing || !contractsReady}
                />
              </div>
              <div className={styles.row}>
                <div className={cn(styles.formGroup, styles.inputFlex)}>
                  <label htmlFor="cert-issue-unique-id" className={styles.label}>
                    unique_id (field)
                  </label>
                  <Input
                    id="cert-issue-unique-id"
                    value={issueUniqueId}
                    onChange={(e) => setIssueUniqueId(e.target.value)}
                    placeholder="0"
                    disabled={isProcessing || !contractsReady}
                  />
                </div>
                <div className={cn(styles.formGroup, styles.inputFlex)}>
                  <label
                    htmlFor="cert-issue-revocation-id"
                    className={styles.label}
                  >
                    revocation_id (field)
                  </label>
                  <Input
                    id="cert-issue-revocation-id"
                    value={issueRevocationId}
                    onChange={(e) => setIssueRevocationId(e.target.value)}
                    placeholder="0"
                    disabled={isProcessing || !contractsReady}
                  />
                </div>
              </div>
              <Button
                variant="primary"
                onClick={handleIssueCertificate}
                disabled={
                  !issueUser.trim() ||
                  !issueUniqueId.trim() ||
                  !issueRevocationId.trim() ||
                  isProcessing ||
                  isWalletBusy ||
                  !contractsReady
                }
                isLoading={isProcessing}
              >
                Issue certificate
              </Button>
            </section>

            {/* Guardian: revoke_certificate */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>
                Guardian – Revoke certificate
              </h3>
              <div className={styles.row}>
                <div className={cn(styles.formGroup, styles.inputFlex)}>
                  <label
                    htmlFor="cert-revoke-revocation-id"
                    className={styles.label}
                  >
                    revocation_id (field)
                  </label>
                  <Input
                    id="cert-revoke-revocation-id"
                    value={revokeRevocationId}
                    onChange={(e) => setRevokeRevocationId(e.target.value)}
                    placeholder="0"
                    disabled={isProcessing || !contractsReady}
                  />
                </div>
                <Button
                  variant="danger"
                  onClick={handleRevokeCertificate}
                  disabled={
                    !revokeRevocationId.trim() ||
                    isProcessing ||
                    isWalletBusy ||
                    !contractsReady
                  }
                  isLoading={isProcessing}
                >
                  Revoke certificate
                </Button>
              </div>
            </section>

            {/* Read: get_certificate_count */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Read – Certificate count</h3>
              <div className={styles.row}>
                <div className={cn(styles.formGroup, styles.inputFlex)}>
                  <label htmlFor="cert-count-owner" className={styles.label}>
                    Owner address
                  </label>
                  <Input
                    id="cert-count-owner"
                    value={countOwner}
                    onChange={(e) => setCountOwner(e.target.value)}
                    placeholder="0x..."
                    disabled={isProcessing || !contractsReady}
                  />
                </div>
                <Button
                  variant="secondary"
                  onClick={handleGetCertificateCount}
                  disabled={
                    !countOwner.trim() ||
                    isProcessing ||
                    isWalletBusy ||
                    !contractsReady
                  }
                  isLoading={readPending}
                >
                  Get count
                </Button>
              </div>
              {certificateCount !== null && (
                <p className="text-sm text-muted mt-2">
                  Certificate count: <strong>{certificateCount}</strong>
                </p>
              )}
            </section>

            {/* User: check_certificate (uses connected account + authwit_nonce 0) */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>User – Check certificate</h3>
              <p className={styles.checkHelper}>
                Uses your connected account and authwit_nonce 0.
              </p>
              <Button
                variant={checkCertificateStatus === 'success' ? 'secondary' : 'primary'}
                className={checkCertificateStatus === 'success' ? styles.checkButtonSuccess : undefined}
                icon={
                  checkCertificateStatus === 'success' ? (
                    <CheckCircle size={iconSize()} />
                  ) : undefined
                }
                onClick={handleCheckCertificate}
                disabled={
                  !connectedAddress ||
                  isProcessing ||
                  isWalletBusy ||
                  !contractsReady
                }
                isLoading={isProcessing}
              >
                {checkCertificateStatus === 'success'
                  ? 'Certificate valid'
                  : 'Check certificate'}
              </Button>
            </section>

            {/* User: cancel_authwit */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>User – Cancel authwit</h3>
              <div className={styles.row}>
                <div className={cn(styles.formGroup, styles.inputFlex)}>
                  <label
                    htmlFor="cert-cancel-inner-hash"
                    className={styles.label}
                  >
                    inner_hash (field)
                  </label>
                  <Input
                    id="cert-cancel-inner-hash"
                    value={cancelInnerHash}
                    onChange={(e) => setCancelInnerHash(e.target.value)}
                    placeholder="0"
                    disabled={isProcessing || !contractsReady}
                  />
                </div>
                <Button
                  variant="secondary"
                  onClick={handleCancelAuthwit}
                  disabled={
                    !cancelInnerHash.trim() ||
                    isProcessing ||
                    isWalletBusy ||
                    !contractsReady
                  }
                  isLoading={isProcessing}
                >
                  Cancel authwit
                </Button>
              </div>
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
};
