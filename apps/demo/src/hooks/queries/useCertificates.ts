import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import type { NoteDao } from '@aztec/stdlib/note';
import { useAztecWallet, hasAppManagedPXE } from '../../aztec-wallet';
import { contractsConfig } from '../../config/contracts';
import {
  decodeCertificateNotes,
  decodeContentNotes,
  deduplicateContentNotesById,
  getExpectedContentNoteIds,
} from '../../domain/certificates';
import { queuePxeCall } from '../../utils';
import { queryKeys } from './queryKeys';
import type { CertificateData } from '../../domain/certificates';

export type { CertificateData } from '../../domain/certificates';

const CERTIFICATES_STORAGE_SLOT = new Fr(3n);
const CONTENT_NOTES_STORAGE_SLOT = new Fr(4n);

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

      const decodedCertificates = decodeCertificateNotes(notes);
      const decodedContentNotes = decodeContentNotes(contentNotes);
      const contentById = deduplicateContentNotesById(decodedContentNotes);

      return decodedCertificates.map((certificate) => {
        const linkedContentNotes = getExpectedContentNoteIds(
          certificate.uniqueId,
          certificate.contentType
        )
          .map((contentId) => contentById.get(contentId))
          .filter((note) => note !== undefined);

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
