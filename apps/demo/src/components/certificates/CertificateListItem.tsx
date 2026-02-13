import React from 'react';
import {
  buildCertificateContentSections,
  getCertificateContentTypeLabel,
} from '../../domain/certificates';
import { truncateAddress } from '../../utils';
import type { CertificateData } from '../../domain/certificates';

const styles = {
  card: 'rounded-lg border border-default bg-surface-tertiary p-3 space-y-2',
  row: 'flex flex-wrap items-center gap-x-2 gap-y-1 text-sm',
  label: 'text-muted shrink-0',
  value: 'font-mono text-default break-all',
  contentContainer: 'rounded-md border border-default bg-surface p-2 space-y-2',
  contentTitle: 'text-xs font-semibold text-default',
  contentRow: 'flex flex-wrap items-center gap-x-2 gap-y-1 text-xs',
  contentLabel: 'text-muted shrink-0',
  contentValue: 'font-mono text-default break-all',
  contentEmpty: 'text-xs text-muted',
} as const;

interface CertificateListItemProps {
  certificate: CertificateData;
  index: number;
}

export const CertificateListItem: React.FC<CertificateListItemProps> = ({
  certificate,
  index,
}) => {
  const contentSections = buildCertificateContentSections({
    uniqueId: certificate.uniqueId,
    contentType: certificate.contentType,
    contentNotes: certificate.contentNotes,
  });

  return (
    <div
      key={`${certificate.revocationId}-${index}`}
      className={styles.card}
      data-testid="certificate-card"
    >
      <div className={styles.row}>
        <span className={styles.label}>Owner:</span>
        <span className={styles.value} title={certificate.owner}>
          {truncateAddress(certificate.owner)}
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Guardian:</span>
        <span className={styles.value} title={certificate.guardian}>
          {truncateAddress(certificate.guardian)}
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Type:</span>
        <span className={styles.value}>
          {getCertificateContentTypeLabel(certificate.contentType)}
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Unique ID:</span>
        <span className={styles.value}>{certificate.uniqueId}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Revocation ID:</span>
        <span className={styles.value}>{certificate.revocationId}</span>
      </div>
      {contentSections.length === 0 ? (
        <p className={styles.contentEmpty}>
          No linked content notes found for this certificate.
        </p>
      ) : (
        contentSections.map((section) => (
          <div
            key={`${certificate.revocationId}-${section.contentId}`}
            className={styles.contentContainer}
          >
            <div className={styles.contentTitle}>
              {section.title} (index {section.index})
            </div>
            {section.fields.map((field) => (
              <div
                key={`${section.contentId}-${field.label}`}
                className={styles.contentRow}
              >
                <span className={styles.contentLabel}>{field.label}:</span>
                <span className={styles.contentValue}>{field.value}</span>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
};
