import { normalizeFieldString } from '../decoder';
import { kycContentTypeHandler } from './kyc';
import type { CertificateContentSection, ContentNoteData } from '../types';
import type {
  CertificateContentTypeHandler,
  CertificateContentViewInput,
} from './types';

const handlers: CertificateContentTypeHandler[] = [kycContentTypeHandler];

const handlerByType = handlers.reduce<
  Map<string, CertificateContentTypeHandler>
>((acc, handler) => {
  acc.set(handler.contentType, handler);
  return acc;
}, new Map());

const getHandler = (
  contentType: string
): CertificateContentTypeHandler | undefined =>
  handlerByType.get(normalizeFieldString(contentType));

const getGenericContentIndex = (
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

const buildGenericSections = ({
  uniqueId,
  contentNotes,
}: CertificateContentViewInput): CertificateContentSection[] =>
  contentNotes
    .map((note) => {
      const index = getGenericContentIndex(uniqueId, note.contentId);
      if (index === null) {
        return null;
      }
      return {
        index,
        title: `Content note ${index}`,
        contentId: note.contentId,
        fields: note.data.map((value, fieldIndex) => ({
          label: `field_${fieldIndex}`,
          value,
        })),
      };
    })
    .filter((section): section is CertificateContentSection => section !== null)
    .sort((a, b) => a.index - b.index);

export const getCertificateContentTypeLabel = (contentType: string): string => {
  const normalizedType = normalizeFieldString(contentType);
  const handler = getHandler(normalizedType);
  if (!handler) {
    return `Unknown (${contentType})`;
  }
  return `${handler.label} (${normalizedType})`;
};

export const getExpectedContentNoteIds = (
  uniqueId: string,
  contentType: string
): string[] => {
  const handler = getHandler(contentType);
  if (!handler) {
    return [];
  }
  return handler.getExpectedContentIds(uniqueId);
};

export const buildCertificateContentSections = (
  input: CertificateContentViewInput
): CertificateContentSection[] => {
  const handler = getHandler(input.contentType);
  if (!handler) {
    return buildGenericSections(input);
  }
  return handler.buildSections(input);
};

export const deduplicateContentNotesById = (
  contentNotes: ContentNoteData[]
): Map<string, ContentNoteData> =>
  contentNotes.reduce<Map<string, ContentNoteData>>((acc, note) => {
    acc.set(note.contentId, note);
    return acc;
  }, new Map());
