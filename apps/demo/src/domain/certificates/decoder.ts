import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { NoteDao } from '@aztec/stdlib/note';
import type { CertificateData, ContentNoteData } from './types';

const UNKNOWN_CONTENT_TYPE = '0';

export const normalizeFieldString = (value: string): string => {
  try {
    return BigInt(value).toString();
  } catch {
    return value;
  }
};

export const decodeCertificateNote = (dao: NoteDao): CertificateData | null => {
  try {
    const items = dao.note.items;
    if (!items || items.length < 4) return null;

    // Support both layouts:
    // - [guardian, unique_id, revocation_id, content_type]
    // - [owner, guardian, unique_id, revocation_id, content_type]
    const owner = dao.owner.toString();
    const guardian = AztecAddress.fromField(items[items.length - 4]).toString();
    const uniqueId = normalizeFieldString(items[items.length - 3].toString());
    const revocationId = normalizeFieldString(
      items[items.length - 2].toString()
    );
    const contentType = normalizeFieldString(
      items[items.length - 1]?.toString() ?? UNKNOWN_CONTENT_TYPE
    );

    return {
      owner,
      guardian,
      uniqueId,
      revocationId,
      contentType,
      contentNotes: [],
    };
  } catch {
    return null;
  }
};

export const decodeContentNote = (dao: NoteDao): ContentNoteData | null => {
  try {
    const items = dao.note.items;
    // Support [content_id, data[8]] and [owner, content_id, data[8]].
    if (!items || items.length < 9) return null;
    const contentId = normalizeFieldString(items[items.length - 9].toString());
    const data = items.slice(-8).map((item) => item.toString());
    return { contentId, data };
  } catch {
    return null;
  }
};

export const decodeCertificateNotes = (notes: NoteDao[]): CertificateData[] =>
  notes
    .map(decodeCertificateNote)
    .filter(
      (certificate): certificate is CertificateData => certificate !== null
    );

export const decodeContentNotes = (notes: NoteDao[]): ContentNoteData[] =>
  notes
    .map(decodeContentNote)
    .filter(
      (contentNote): contentNote is ContentNoteData => contentNote !== null
    );
