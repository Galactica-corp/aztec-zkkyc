import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import {
  useAztecWallet,
  hasAppManagedPXE,
} from '../../aztec-wallet';
import { contractsConfig } from '../../config/contracts';
import { queuePxeCall } from '../../utils';
import { queryKeys } from './queryKeys';
import type { NoteDao } from '@aztec/stdlib/note';

/**
 * Decoded certificate data from a CertificateNote (owner, guardian, unique_id, revocation_id).
 */
export interface CertificateData {
  owner: string;
  guardian: string;
  uniqueId: string;
  revocationId: string;
}

const CERTIFICATES_STORAGE_SLOT = new Fr(3n);

function decodeCertificateNote(dao: NoteDao): CertificateData | null {
  try {
    const items = dao.note.items;
    if (!items || items.length < 4) return null;
    const owner = AztecAddress.fromField(items[0]).toString();
    const guardian = AztecAddress.fromField(items[1]).toString();
    const uniqueId = items[2].toString();
    const revocationId = items[3].toString();
    return { owner, guardian, uniqueId, revocationId };
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
  const {
    account,
    connector,
    currentConfig,
    isPXEInitialized,
  } = useAztecWallet();
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
      const decoded = notes
        .map(decodeCertificateNote)
        .filter((c): c is CertificateData => c !== null);
      return decoded;
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
