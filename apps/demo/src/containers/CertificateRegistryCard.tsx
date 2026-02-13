import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { FileCheck, AlertTriangle, Shield, RefreshCw, CheckCircle, Dice5 } from 'lucide-react';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { poseidon2Hash } from '@aztec/foundation/crypto/poseidon';
import { iso31661, iso31662 } from 'iso-3166';
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
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../components/ui';
import { useRequiredContracts, useCertificates } from '../hooks';
import { useWriteContract } from '../hooks/contracts';
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
  subsectionTitle: 'text-xs font-semibold text-default mb-2 mt-4 first:mt-0',
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
  // Role tabs
  roleSelectorContainer: 'space-y-2 mb-2',
  roleSelectorTitle: 'text-sm font-semibold text-default',
  tabsList: 'w-full',
  tabContent: 'space-y-6 mt-4',
  kycSection: 'space-y-3 rounded-lg border border-default bg-surface-tertiary p-3',
  kycSectionTitle: 'text-xs font-semibold text-default uppercase tracking-wide',
  kycGrid: 'grid grid-cols-1 gap-3 sm:grid-cols-2',
  inputWithIconContainer: 'relative',
  inputWithIcon: 'pr-12',
  inputInlineButton: 'absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2',
} as const;

const CONTENT_TYPE_ZK_KYC = 1n;
const DEFAULT_KYC_BIRTHDAY_DATE = '1990-06-01';
const DEFAULT_KYC_VERIFICATION_LEVEL = '2';
const EMPTY_REGION_VALUE = '__none__';

const toPaddedField = (value: string): Fr =>
  Fr.fromBufferReduce(Buffer.from(value.padEnd(32, '#'), 'utf8'));

const hashStringToField = async (value: string): Promise<bigint> => {
  const hash = await poseidon2Hash([toPaddedField(value)]);
  return hash.toBigInt();
};

const parseBirthdayDateToUnix = (value: string): bigint | null => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  const timestampMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const date = new Date(timestampMs);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return BigInt(Math.floor(timestampMs / 1000));
};

const getRandomFieldElementString = (): string => Fr.random().toBigInt().toString();

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
  } = useRequiredContracts(['certificateRegistry', 'ageCheckRequirement'] as const);

  const { writeContract, isPending: writePending } = useWriteContract();
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
  const [kycSurname, setKycSurname] = useState('DOE');
  const [kycForename, setKycForename] = useState('JANE');
  const [kycMiddlename, setKycMiddlename] = useState('');
  const [kycBirthdayDate, setKycBirthdayDate] = useState(DEFAULT_KYC_BIRTHDAY_DATE);
  const [kycCitizenship, setKycCitizenship] = useState('DEU');
  const [kycVerificationLevel, setKycVerificationLevel] = useState(DEFAULT_KYC_VERIFICATION_LEVEL);
  const [kycStreetAndNumber, setKycStreetAndNumber] = useState('MUSTERSTRASSE 10');
  const [kycPostcode, setKycPostcode] = useState('10115');
  const [kycTown, setKycTown] = useState('BERLIN');
  const [kycRegion, setKycRegion] = useState('DE-BE');
  const [kycCountry, setKycCountry] = useState('DEU');

  // Form state: revoke_certificate
  const [revokeRevocationId, setRevokeRevocationId] = useState('');

  // Form state: check_certificate (uses connected account + authwit_nonce 0)
  const [checkCertificateStatus, setCheckCertificateStatus] = useState<
    'idle' | 'pending' | 'success'
  >('idle');
  const [checkRequirementAddress, setCheckRequirementAddress] = useState('');
  const [checkWithRequirementsStatus, setCheckWithRequirementsStatus] = useState<
    'idle' | 'pending' | 'success'
  >('idle');

  // Form state: cancel_authwit
  const [cancelInnerHash, setCancelInnerHash] = useState('');

  const isProcessing = writePending;
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

  const countryOptions = useMemo(
    () =>
      iso31661
        .map((entry) => ({
          alpha2: entry.alpha2,
          alpha3: entry.alpha3,
          name: entry.name,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    []
  );

  const alpha2ByAlpha3 = useMemo(
    () =>
      countryOptions.reduce<Record<string, string>>((acc, country) => {
        acc[country.alpha3] = country.alpha2;
        return acc;
      }, {}),
    [countryOptions]
  );

  const regionOptions = useMemo(() => {
    const alpha2 = alpha2ByAlpha3[kycCountry];
    if (!alpha2) return [];

    return iso31662
      .filter((entry) => entry.code.startsWith(`${alpha2}-`))
      .map((entry) => ({
        code: entry.code,
        name: entry.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [alpha2ByAlpha3, kycCountry]);

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
    const birthdayUnix = parseBirthdayDateToUnix(kycBirthdayDate);
    const verificationLevel = parseField(kycVerificationLevel);

    if (uniqueId === null || revocationId === null || birthdayUnix === null || verificationLevel === null) {
      toastError(
        'Invalid fields',
        'unique_id, revocation_id and verification_level must be non-negative integers, and birthday must be a valid date'
      );
      return;
    }

    if (verificationLevel > 2n) {
      toastError(
        'Invalid verification level',
        'verification_level must be 0, 1, or 2'
      );
      return;
    }

    const requiredTextValues = [
      ['surname', kycSurname],
      ['forename', kycForename],
      ['citizenship', kycCitizenship],
      ['streetAndNumber', kycStreetAndNumber],
      ['postcode', kycPostcode],
      ['town', kycTown],
      ['country', kycCountry],
    ];
    const missingValue = requiredTextValues.find(([, value]) => value.trim() === '');
    if (missingValue) {
      toastError('Missing KYC field', `${missingValue[0]} is required`);
      return;
    }

    try {
      const kycPersonalData = [
        await hashStringToField(kycSurname.trim()),
        await hashStringToField(kycForename.trim()),
        await hashStringToField(kycMiddlename.trim()),
        birthdayUnix,
        await hashStringToField(kycCitizenship.trim()),
        verificationLevel,
        0n,
        0n,
      ];
      const kycAddressData = [
        await hashStringToField(kycStreetAndNumber.trim()),
        await hashStringToField(kycPostcode.trim()),
        await hashStringToField(kycTown.trim()),
        await hashStringToField(kycRegion.trim()),
        await hashStringToField(kycCountry.trim()),
        0n,
        0n,
        0n,
      ];

      const result = await writeContract({
        contract: CertificateRegistryContract,
        address: registryAddress,
        functionName: 'issue_certificate',
        args: [
          AztecAddress.fromString(issueUser.trim()),
          uniqueId,
          revocationId,
          CONTENT_TYPE_ZK_KYC,
          kycPersonalData,
          kycAddressData,
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
    kycSurname,
    kycForename,
    kycMiddlename,
    kycBirthdayDate,
    kycCitizenship,
    kycVerificationLevel,
    kycStreetAndNumber,
    kycPostcode,
    kycTown,
    kycRegion,
    kycCountry,
    writeContract,
    feePaymentMethod,
    success,
    toastError,
  ]);

  const fillRandomUniqueId = useCallback(() => {
    setIssueUniqueId(getRandomFieldElementString());
  }, []);

  const fillRandomRevocationId = useCallback(() => {
    setIssueRevocationId(getRandomFieldElementString());
  }, []);

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

  useEffect(() => {
    const defaultRequirementAddress =
      currentConfig?.ageCheckRequirementContractAddress ?? '';
    setCheckRequirementAddress(defaultRequirementAddress);
    setCheckWithRequirementsStatus('idle');
  }, [currentConfig]);

  const handleCheckCertificateWithRequirements = useCallback(async () => {
    if (!registryAddress || !connectedAddress || !checkRequirementAddress.trim()) {
      return;
    }

    setCheckWithRequirementsStatus('pending');
    try {
      const result = await writeContract({
        contract: CertificateRegistryContract,
        address: registryAddress,
        functionName: 'check_certificate_and_requirements',
        args: [
          AztecAddress.fromString(connectedAddress),
          0n,
          AztecAddress.fromString(checkRequirementAddress.trim()),
        ],
        feePaymentMethod,
      });
      if (result.success) {
        setCheckWithRequirementsStatus('success');
        success('Certificate checked with requirements', 'Valid certificate');
      } else {
        setCheckWithRequirementsStatus('idle');
        toastError('Failed', result.error ?? 'Unknown error');
      }
    } catch (err) {
      setCheckWithRequirementsStatus('idle');
      toastError('Failed', err instanceof Error ? err.message : 'Unknown error');
    }
  }, [
    registryAddress,
    connectedAddress,
    checkRequirementAddress,
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
        {contractsLoading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner} />
            <p className={styles.loadingText}>
              Loading contracts: {pendingContracts.join(', ')}...
            </p>
          </div>
        ) : (
          <div className={styles.roleSelectorContainer}>
            <h3 className={styles.roleSelectorTitle}>Select Role</h3>
            <Tabs defaultValue="user">
              <TabsList className={styles.tabsList}>
                <TabsTrigger value="admin">Admin</TabsTrigger>
                <TabsTrigger value="guardian">Guardian</TabsTrigger>
                <TabsTrigger value="user">User</TabsTrigger>
              </TabsList>

            <TabsContent value="admin" className={styles.tabContent}>
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Guardian whitelist</h3>
                <div className={styles.formGroup}>
                  <label htmlFor="cert-guardian-add" className={styles.subsectionTitle}>
                    Add guardian to whitelist
                  </label>
                  <div className={styles.row}>
                    <Input
                      id="cert-guardian-add"
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
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="cert-guardian-remove" className={styles.subsectionTitle}>
                    Remove guardian from whitelist
                  </label>
                  <div className={styles.row}>
                    <Input
                      id="cert-guardian-remove"
                      value={guardianAddress}
                      onChange={(e) => setGuardianAddress(e.target.value)}
                      placeholder="0x..."
                      disabled={isProcessing || !contractsReady}
                      className={styles.inputFlex}
                    />
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
            </TabsContent>

            <TabsContent value="guardian" className={styles.tabContent}>
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Issue certificate</h3>
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
                    <div className={styles.inputWithIconContainer}>
                      <Input
                        id="cert-issue-unique-id"
                        value={issueUniqueId}
                        onChange={(e) => setIssueUniqueId(e.target.value)}
                        placeholder="0"
                        disabled={isProcessing || !contractsReady}
                        className={styles.inputWithIcon}
                      />
                      <Button
                        type="button"
                        variant="icon"
                        size="icon"
                        className={styles.inputInlineButton}
                        onClick={fillRandomUniqueId}
                        disabled={isProcessing || !contractsReady}
                        aria-label="Generate random unique ID in field"
                      >
                        <Dice5 size={iconSize()} />
                      </Button>
                    </div>
                  </div>
                  <div className={cn(styles.formGroup, styles.inputFlex)}>
                    <label
                      htmlFor="cert-issue-revocation-id"
                      className={styles.label}
                    >
                      revocation_id (field)
                    </label>
                    <div className={styles.inputWithIconContainer}>
                      <Input
                        id="cert-issue-revocation-id"
                        value={issueRevocationId}
                        onChange={(e) => setIssueRevocationId(e.target.value)}
                        placeholder="0"
                        disabled={isProcessing || !contractsReady}
                        className={styles.inputWithIcon}
                      />
                      <Button
                        type="button"
                        variant="icon"
                        size="icon"
                        className={styles.inputInlineButton}
                        onClick={fillRandomRevocationId}
                        disabled={isProcessing || !contractsReady}
                        aria-label="Generate random revocation ID in field"
                      >
                        <Dice5 size={iconSize()} />
                      </Button>
                    </div>
                  </div>
                </div>
                <section className={styles.kycSection}>
                  <h4 className={styles.kycSectionTitle}>KYC personal note</h4>
                  <div className={styles.kycGrid}>
                    <div className={styles.formGroup}>
                      <label htmlFor="cert-kyc-surname" className={styles.label}>
                        surname
                      </label>
                      <Input
                        id="cert-kyc-surname"
                        value={kycSurname}
                        onChange={(e) => setKycSurname(e.target.value)}
                        placeholder="DOE"
                        disabled={isProcessing || !contractsReady}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="cert-kyc-forename" className={styles.label}>
                        forename
                      </label>
                      <Input
                        id="cert-kyc-forename"
                        value={kycForename}
                        onChange={(e) => setKycForename(e.target.value)}
                        placeholder="JANE"
                        disabled={isProcessing || !contractsReady}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="cert-kyc-middlename" className={styles.label}>
                        middlename
                      </label>
                      <Input
                        id="cert-kyc-middlename"
                        value={kycMiddlename}
                        onChange={(e) => setKycMiddlename(e.target.value)}
                        placeholder="Optional"
                        disabled={isProcessing || !contractsReady}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="cert-kyc-birthday-unix" className={styles.label}>
                        birthday (UTC date)
                      </label>
                      <Input
                        id="cert-kyc-birthday-unix"
                        type="date"
                        value={kycBirthdayDate}
                        onChange={(e) => setKycBirthdayDate(e.target.value)}
                        disabled={isProcessing || !contractsReady}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="cert-kyc-citizenship" className={styles.label}>
                        citizenship (ISO-3166 alpha-3)
                      </label>
                      <Select
                        value={kycCitizenship}
                        onValueChange={setKycCitizenship}
                        disabled={isProcessing || !contractsReady}
                      >
                        <SelectTrigger id="cert-kyc-citizenship">
                          <SelectValue placeholder="Select citizenship" />
                        </SelectTrigger>
                        <SelectContent>
                          {countryOptions.map((country) => (
                            <SelectItem key={country.alpha3} value={country.alpha3}>
                              {country.alpha3} - {country.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="cert-kyc-verification-level" className={styles.label}>
                        verification_level (0-2)
                      </label>
                      <Select
                        value={kycVerificationLevel}
                        onValueChange={setKycVerificationLevel}
                        disabled={isProcessing || !contractsReady}
                      >
                        <SelectTrigger id="cert-kyc-verification-level">
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0 - Basic</SelectItem>
                          <SelectItem value="1">1 - Intermediate</SelectItem>
                          <SelectItem value="2">2 - Enhanced</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </section>
                <section className={styles.kycSection}>
                  <h4 className={styles.kycSectionTitle}>KYC address note</h4>
                  <div className={styles.kycGrid}>
                    <div className={styles.formGroup}>
                      <label htmlFor="cert-kyc-street-and-number" className={styles.label}>
                        street_and_number
                      </label>
                      <Input
                        id="cert-kyc-street-and-number"
                        value={kycStreetAndNumber}
                        onChange={(e) => setKycStreetAndNumber(e.target.value)}
                        placeholder="MUSTERSTRASSE 10"
                        disabled={isProcessing || !contractsReady}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="cert-kyc-postcode" className={styles.label}>
                        postcode
                      </label>
                      <Input
                        id="cert-kyc-postcode"
                        value={kycPostcode}
                        onChange={(e) => setKycPostcode(e.target.value)}
                        placeholder="10115"
                        disabled={isProcessing || !contractsReady}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="cert-kyc-town" className={styles.label}>
                        town
                      </label>
                      <Input
                        id="cert-kyc-town"
                        value={kycTown}
                        onChange={(e) => setKycTown(e.target.value)}
                        placeholder="BERLIN"
                        disabled={isProcessing || !contractsReady}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="cert-kyc-region" className={styles.label}>
                        region (ISO-3166-2 optional)
                      </label>
                      <Select
                        value={kycRegion || EMPTY_REGION_VALUE}
                        onValueChange={(value) =>
                          setKycRegion(value === EMPTY_REGION_VALUE ? '' : value)
                        }
                        disabled={isProcessing || !contractsReady}
                      >
                        <SelectTrigger id="cert-kyc-region">
                          <SelectValue placeholder="Select region (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={EMPTY_REGION_VALUE}>None</SelectItem>
                          {regionOptions.map((region) => (
                            <SelectItem key={region.code} value={region.code}>
                              {region.code} - {region.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="cert-kyc-country" className={styles.label}>
                        country (ISO-3166 alpha-3)
                      </label>
                      <Select
                        value={kycCountry}
                        onValueChange={(value) => {
                          setKycCountry(value);
                          const alpha2 = alpha2ByAlpha3[value];
                          if (!alpha2 || !kycRegion.startsWith(`${alpha2}-`)) {
                            setKycRegion('');
                          }
                        }}
                        disabled={isProcessing || !contractsReady}
                      >
                        <SelectTrigger id="cert-kyc-country">
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                        <SelectContent>
                          {countryOptions.map((country) => (
                            <SelectItem key={country.alpha3} value={country.alpha3}>
                              {country.alpha3} - {country.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </section>
                <Button
                  variant="primary"
                  onClick={handleIssueCertificate}
                  disabled={
                    !issueUser.trim() ||
                    !issueUniqueId.trim() ||
                    !issueRevocationId.trim() ||
                    !kycBirthdayDate.trim() ||
                    !kycSurname.trim() ||
                    !kycForename.trim() ||
                    !kycCitizenship.trim() ||
                    !kycStreetAndNumber.trim() ||
                    !kycPostcode.trim() ||
                    !kycTown.trim() ||
                    !kycCountry.trim() ||
                    isProcessing ||
                    isWalletBusy ||
                    !contractsReady
                  }
                  isLoading={isProcessing}
                >
                  Issue certificate
                </Button>
              </section>
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Revoke certificate</h3>
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
            </TabsContent>

            <TabsContent value="user" className={styles.tabContent}>
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
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Check certificate</h3>
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
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Check certificate with requirements</h3>
                <p className={styles.checkHelper}>
                  Uses your connected account, authwit_nonce 0, and a requirement
                  checker contract.
                </p>
                <div className={styles.formGroup}>
                  <label htmlFor="cert-check-requirement-address" className={styles.label}>
                    Requirement contract address
                  </label>
                  <Input
                    id="cert-check-requirement-address"
                    value={checkRequirementAddress}
                    onChange={(e) => setCheckRequirementAddress(e.target.value)}
                    placeholder="0x..."
                    disabled={isProcessing || !contractsReady}
                  />
                </div>
                <Button
                  variant={checkWithRequirementsStatus === 'success' ? 'secondary' : 'primary'}
                  className={checkWithRequirementsStatus === 'success' ? styles.checkButtonSuccess : undefined}
                  icon={
                    checkWithRequirementsStatus === 'success' ? (
                      <CheckCircle size={iconSize()} />
                    ) : undefined
                  }
                  onClick={handleCheckCertificateWithRequirements}
                  disabled={
                    !connectedAddress ||
                    !checkRequirementAddress.trim() ||
                    isProcessing ||
                    isWalletBusy ||
                    !contractsReady
                  }
                  isLoading={isProcessing}
                >
                  {checkWithRequirementsStatus === 'success'
                    ? 'Certificate valid'
                    : 'Check with requirements'}
                </Button>
              </section>
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Cancel authwit</h3>
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
            </TabsContent>
            </Tabs>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
