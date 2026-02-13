import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import type { NoteDao } from '@aztec/stdlib/note';
import { useAztecWallet, hasAppManagedPXE } from '../../aztec-wallet';
import { contractsConfig } from '../../config/contracts';
import { queuePxeCall } from '../../utils';
import { queryKeys } from './queryKeys';

/**
 * Decoded certificate data from a CertificateNote (owner, guardian, unique_id, revocation_id).
 */
export interface CertificateData {
  owner: string;
  guardian: string;
  uniqueId: string;
  revocationId: string;
  contentType: string;
  contentNotes: ContentNoteData[];
}

const CERTIFICATES_STORAGE_SLOT = new Fr(3n);
const CONTENT_NOTES_STORAGE_SLOT = new Fr(4n);

export interface ContentNoteData {
  contentId: string;
  data: string[];
}

const UNKNOWN_CONTENT_TYPE = '0';

const normalizeFieldString = (value: string): string => {
  try {
    return BigInt(value).toString();
  } catch {
    return value;
  }
};

function decodeCertificateNote(dao: NoteDao): CertificateData | null {
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
}

function decodeContentNote(dao: NoteDao): ContentNoteData | null {
  try {
    const items = dao.note.items;
    // We decode from the tail to support both [content_id, data[8]]
    // and [owner, content_id, data[8]] note layouts.
    if (!items || items.length < 9) return null;
    const contentId = normalizeFieldString(items[items.length - 9].toString());
    const data = items.slice(-8).map((item) => item.toString());
    return { contentId, data };
  } catch {
    return null;
  }
}

interface UseCertificatesOptions {
  enabled?: boolean;
}

interface UseCertificatesReturn {
  certificates: CertificateData[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Fetches certificates owned by the current account from the Certificate Registry contract.
 * Uses PXE getNotes (only available when using embedded or external signer wallet).
 */
export const useCertificates = (
  options: UseCertificatesOptions = {}
): UseCertificatesReturn => {
  const { account, connector, currentConfig, isPXEInitialized } =
    useAztecWallet();
  const queryClient = useQueryClient();

  const registryAddress = currentConfig
    ? contractsConfig.certificateRegistry.address(currentConfig)
    : undefined;
  const ownerAddress = account?.getAddress().toString() ?? '';

  const canFetch =
    hasAppManagedPXE(connector) &&
    isPXEInitialized &&
    account &&
    registryAddress &&
    ownerAddress &&
    (options.enabled ?? true);

  const query = useQuery({
    queryKey: queryKeys.certificates.list(registryAddress ?? '', ownerAddress),
    queryFn: async (): Promise<CertificateData[]> => {
      const pxe = connector!.getPXE();
      if (!pxe || !registryAddress || !account) {
        return [];
      }
      const contractAddress = AztecAddress.fromString(registryAddress);
      const owner = account.getAddress();
      const notes = await queuePxeCall(() =>
        pxe.getNotes({
          contractAddress,
          owner,
          storageSlot: CERTIFICATES_STORAGE_SLOT,
        })
      );
      let contentNotes: NoteDao[] = [];
      try {
        contentNotes = await queuePxeCall(() =>
          pxe.getNotes({
            contractAddress,
            owner,
            storageSlot: CONTENT_NOTES_STORAGE_SLOT,
          })
        );
      } catch (contentNotesError) {
        console.warn(
          '[useCertificates] Failed to fetch content notes, showing certificates without content',
          contentNotesError
        );
      }

      const decodedCertificates = notes
        .map(decodeCertificateNote)
        .filter((c): c is CertificateData => c !== null);
      const decodedContentNotes = contentNotes
        .map(decodeContentNote)
        .filter((c): c is ContentNoteData => c !== null);

      const contentById = decodedContentNotes.reduce<
        Map<string, ContentNoteData>
      >((acc, note) => {
        acc.set(note.contentId, note);
        return acc;
      }, new Map());

      return decodedCertificates.map((certificate) => {
        const linkedContentNotes: ContentNoteData[] = [];
        try {
          const uniqueId = BigInt(certificate.uniqueId);
          for (const contentIndex of [0n, 1n]) {
            const contentNote = contentById.get(
              (uniqueId + contentIndex).toString()
            );
            if (contentNote) {
              linkedContentNotes.push(contentNote);
            }
          }
        } catch {
          // Invalid unique_id should not break the full certificates query.
        }

        return {
          ...certificate,
          contentNotes: linkedContentNotes,
        };
      });
    },
    enabled: canFetch,
    staleTime: 30_000,
  });

  const refetch = async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.certificates.list(
        registryAddress ?? '',
        ownerAddress
      ),
    });
  };

  return {
    certificates: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error as Error | null,
    refetch,
  };
};
