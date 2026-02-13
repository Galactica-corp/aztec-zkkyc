export interface ContentNoteData {
  contentId: string;
  data: string[];
}

export interface CertificateData {
  owner: string;
  guardian: string;
  uniqueId: string;
  revocationId: string;
  contentType: string;
  contentNotes: ContentNoteData[];
}

export interface CertificateContentField {
  label: string;
  value: string;
}

export interface CertificateContentSection {
  index: number;
  title: string;
  fields: CertificateContentField[];
  contentId: string;
}
