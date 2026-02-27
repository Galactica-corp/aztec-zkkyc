import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import type { Fr } from '@aztec/aztec.js/fields';
import type { NoteDao } from '@aztec/stdlib/note';
import { CertificateRegistryContract } from '../../../../../artifacts/CertificateRegistry';
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

const CERTIFICATES_STORAGE_SLOT = CertificateRegistryContract.storage.certificates.slot;
const CONTENT_NOTES_STORAGE_SLOT = CertificateRegistryContract.storage.content_notes.slot;

/** Builds a PXE notes filter for contractAddress + owner + storageSlot (Aztec v4 debug.getNotes). */
function createNotesFilter(
  contractAddress: AztecAddress,
  owner: AztecAddress,
  storageSlot: Fr
) {
  return {
    contractAddress,
    owner,
    storageSlot,
    scopes: [owner] as AztecAddress[],
  };
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
 * Uses PXE debug.getNotes (embedded or external signer wallet only). For a production-ready
 * approach, prefer a contract utility that returns certificate data.
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
    Boolean(account) &&
    Boolean(registryAddress) &&
    Boolean(ownerAddress) &&
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

      let notes: NoteDao[];
      try {
        notes = await queuePxeCall(() =>
          pxe.debug.getNotes(
            createNotesFilter(
              contractAddress,
              owner,
              CERTIFICATES_STORAGE_SLOT
            )
          )
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown error';
        throw new Error(`Failed to load certificates: ${message}`, {
          cause: err instanceof Error ? err : undefined,
        });
      }

      let contentNotes: NoteDao[] = [];
      try {
        contentNotes = await queuePxeCall(() =>
          pxe.debug.getNotes(
            createNotesFilter(
              contractAddress,
              owner,
              CONTENT_NOTES_STORAGE_SLOT
            )
          )
        );
      } catch {
        // Certificates are still shown; content (e.g. KYC fields) will be missing
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
    retry: 1,
  });

  const refetch = async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.certificates.list(
        registryAddress ?? '',
        ownerAddress
      ),
    });
    if (canFetch) {
      await query.refetch();
    }
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
