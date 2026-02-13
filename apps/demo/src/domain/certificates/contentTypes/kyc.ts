import type { CertificateContentSection, ContentNoteData } from '../types';
import type { CertificateContentTypeHandler } from './types';

const CONTENT_TYPE_ZK_KYC = '1';

const KYC_CONTENT_LABELS: Record<number, { title: string; labels: string[] }> =
  {
    0: {
      title: 'Personal note',
      labels: [
        'surname',
        'forename',
        'middlename',
        'birthday (unix)',
        'citizenship',
        'verification_level',
      ],
    },
    1: {
      title: 'Address note',
      labels: ['street_and_number', 'postcode', 'town', 'region', 'country'],
    },
  };

const getContentIndex = (
  uniqueId: string,
  contentId: string
): number | null => {
  try {
    const index = BigInt(contentId) - BigInt(uniqueId);
    if (index < 0n) {
      return null;
    }
    return Number(index);
  } catch {
    return null;
  }
};

const buildSections = ({
  uniqueId,
  contentNotes,
}: {
  uniqueId: string;
  contentNotes: ContentNoteData[];
}): CertificateContentSection[] =>
  contentNotes
    .map((note) => {
      const contentIndex = getContentIndex(uniqueId, note.contentId);
      if (contentIndex === null) {
        return null;
      }

      const layout = KYC_CONTENT_LABELS[contentIndex];
      const labels = layout
        ? layout.labels
        : note.data.map((_, fieldIndex) => `field_${fieldIndex}`);
      const title = layout ? layout.title : `Content note ${contentIndex}`;

      return {
        index: contentIndex,
        title,
        contentId: note.contentId,
        fields: labels.map((label, fieldIndex) => ({
          label,
          value: note.data[fieldIndex] ?? '',
        })),
      };
    })
    .filter((section): section is CertificateContentSection => section !== null)
    .sort((a, b) => a.index - b.index);

export const kycContentTypeHandler: CertificateContentTypeHandler = {
  contentType: CONTENT_TYPE_ZK_KYC,
  label: 'ZK KYC',
  getExpectedContentIds: (uniqueId: string) => {
    try {
      const parsedUniqueId = BigInt(uniqueId);
      return [0n, 1n].map((index) => (parsedUniqueId + index).toString());
    } catch {
      return [];
    }
  },
  buildSections: ({ uniqueId, contentNotes }) =>
    buildSections({ uniqueId, contentNotes }),
};
