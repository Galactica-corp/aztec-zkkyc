import React from 'react';
import { RefreshCw, Shield } from 'lucide-react';
import { cn, iconSize } from '../../utils';
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '../ui';
import { CertificateListItem } from './CertificateListItem';
import type { CertificateData } from '../../domain/certificates';

const styles = {
  section:
    'rounded-xl border border-default bg-surface-secondary shadow-theme p-4 mb-4',
  header: 'flex items-center justify-between gap-2 pb-3',
  title: 'flex items-center gap-2 text-base font-semibold text-default',
  titleIcon: 'text-accent',
  description: 'text-xs text-muted mb-3',
  reloadButton: 'shrink-0',
  fetchingBadge: 'ml-1 inline-block',
  loading: 'flex items-center justify-center gap-3 py-6 text-muted',
  loadingSpinner:
    'animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent',
  list: 'space-y-3',
  empty: 'py-4 text-center text-sm text-muted',
} as const;

interface CertificateListSectionProps {
  certificates: CertificateData[];
  isLoading: boolean;
  isFetching: boolean;
  isWalletBusy: boolean;
  onReload: () => void;
}

export const CertificateListSection: React.FC<CertificateListSectionProps> = ({
  certificates,
  isLoading,
  isFetching,
  isWalletBusy,
  onReload,
}) => {
  return (
    <div className={styles.section} data-testid="certificates-owned-section">
      <div className={styles.header}>
        <div className={styles.title}>
          <Shield size={iconSize('md')} className={styles.titleIcon} />
          My certificates
          {isFetching && !isLoading && (
            <span className={cn(styles.loadingSpinner, styles.fetchingBadge)} />
          )}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="icon"
              size="icon"
              onClick={onReload}
              disabled={isFetching || isWalletBusy}
              isLoading={isFetching}
              className={styles.reloadButton}
              aria-label="Reload certificates"
            >
              <RefreshCw size={iconSize()} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reload certificates</TooltipContent>
        </Tooltip>
      </div>
      <p className={styles.description}>
        For KYC content, string values are stored as Poseidon hashes. Numeric
        fields like birthday and verification level are shown as plain field
        values.
      </p>
      {isLoading ? (
        <div className={styles.loading} data-testid="certificates-loading">
          <div className={styles.loadingSpinner} />
          <span>Loading certificates...</span>
        </div>
      ) : certificates.length === 0 ? (
        <p className={styles.empty}>
          No certificates yet. Get one issued by a whitelisted guardian.
        </p>
      ) : (
        <div className={styles.list}>
          {certificates.map((certificate, index) => (
            <CertificateListItem
              key={`${certificate.revocationId}-${index}`}
              certificate={certificate}
              index={index}
            />
          ))}
        </div>
      )}
    </div>
  );
};
