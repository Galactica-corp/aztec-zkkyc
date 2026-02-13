import type { CertificateContentSection, ContentNoteData } from '../types';

export interface CertificateContentViewInput {
  uniqueId: string;
  contentType: string;
  contentNotes: ContentNoteData[];
}

export interface CertificateContentTypeHandler {
  contentType: string;
  label: string;
  getExpectedContentIds: (uniqueId: string) => string[];
  buildSections: (
    input: CertificateContentViewInput
  ) => CertificateContentSection[];
}
