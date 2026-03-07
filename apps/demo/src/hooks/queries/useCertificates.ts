import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Contract } from '@aztec/aztec.js/contracts';
import { Fr } from '@aztec/aztec.js/fields';
import { CertificateRegistryContract } from '../../../../../artifacts/CertificateRegistry';
import { useAztecWallet, hasAppManagedPXE } from '../../aztec-wallet';
import { SharedPXEService } from '../../aztec-wallet/services/aztec/pxe/SharedPXEService';
import { registerGuardianWhitelistAsSenders } from '../../aztec-wallet/services/aztec/pxe/senderRegistration';
import { contractsConfig } from '../../config/contracts';
import { queuePxeCall } from '../../utils';
import { queryKeys } from './queryKeys';
import type {
  CertificateData,
  ContentNoteData,
} from '../../domain/certificates';

export type { CertificateData } from '../../domain/certificates';

/** Simulated return type of get_user_certificates_and_content (UserCertificatesPage). */
interface UserCertificatesPageResult {
  count: number;
  guardian: bigint;
  unique_id: bigint;
  revocation_id: bigint;
  content_type: bigint;
  content_0_id: bigint;
  content_0_data: bigint[];
  content_1_id: bigint;
  content_1_data: bigint[];
  has_more: boolean;
}

function fieldToString(value: bigint): string {
  return value.toString();
}

/** True if the page contains a real certificate (count > 0 and non-zero ids). */
function isNotEmptyPage(page: UserCertificatesPageResult): boolean {
  if (page.count === 0) return false;
  return (
    page.unique_id !== 0n || page.guardian !== 0n || page.revocation_id !== 0n
  );
}

function pageToCertificateData(
  page: UserCertificatesPageResult,
  owner: string
): CertificateData {
  const guardianAddress = AztecAddress.fromField(
    new Fr(page.guardian)
  ).toString();
  const contentNotes: ContentNoteData[] = [];
  if (page.content_0_id !== 0n) {
    contentNotes.push({
      contentId: fieldToString(page.content_0_id),
      data: page.content_0_data.map(fieldToString),
    });
  }
  if (page.content_1_id !== 0n) {
    contentNotes.push({
      contentId: fieldToString(page.content_1_id),
      data: page.content_1_data.map(fieldToString),
    });
  }
  return {
    owner,
    guardian: guardianAddress,
    uniqueId: fieldToString(page.unique_id),
    revocationId: fieldToString(page.revocation_id),
    contentType: fieldToString(page.content_type),
    contentNotes,
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
 * Fetches certificates owned by the current account via the Certificate Registry
 * contract utility get_user_certificates_and_content (paginated). Requires
 * embedded or external signer wallet.
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
      const wallet = connector!.getWallet();
      const pxe = connector!.getPXE();
      if (!wallet || !pxe || !registryAddress || !account || !currentConfig) {
        return [];
      }
      const contractAddress = AztecAddress.fromString(registryAddress);
      const owner = account.getAddress();

      try {
        // Ensure contract is known to PXE before any read simulation.
        let registeredInstance;
        try {
          registeredInstance = await pxe.getContractInstance(contractAddress);
        } catch {
          registeredInstance = undefined;
        }

        if (!registeredInstance) {
          const deployParams =
            contractsConfig.certificateRegistry.deployParams(currentConfig);
          const { getContractInstanceFromInstantiationParams } = await import(
            '@aztec/aztec.js/contracts'
          );
          const instance = await getContractInstanceFromInstantiationParams(
            CertificateRegistryContract.artifact,
            {
              salt: deployParams.salt,
              deployer: deployParams.deployer,
              constructorArgs: deployParams.constructorArgs,
              constructorArtifact: deployParams.constructorArtifact,
            }
          );

          if (!instance.address.equals(contractAddress)) {
            throw new Error(
              `CertificateRegistry instantiation mismatch: expected ${contractAddress.toString()}, got ${instance.address.toString()}`
            );
          }

          await pxe.registerContract({
            instance,
            artifact: CertificateRegistryContract.artifact,
          });
        }

        const contract = await Contract.at(
          contractAddress,
          CertificateRegistryContract.artifact,
          wallet
        );

        // Keep PXE sender sync in step with the on-chain guardian whitelist so
        // incoming guardian-emitted notes can be discovered by this wallet.
        try {
          const guardianWhitelist = (await queuePxeCall(() =>
            contract.methods
              .get_whitelisted_guardians()
              .simulate({ from: owner })
          )) as bigint[];

          const sharedPxeInstance = SharedPXEService.getExistingInstance(
            currentConfig.nodeUrl,
            currentConfig.name
          );

          if (sharedPxeInstance) {
            await registerGuardianWhitelistAsSenders(
              sharedPxeInstance,
              guardianWhitelist,
              'useCertificates'
            );
          }
        } catch (senderSyncError) {
          // Non-fatal: certificate fetching can continue even if sender sync fails.
          console.warn(
            '[useCertificates] Failed to sync guardian whitelist senders',
            senderSyncError
          );
        }

        const certificates: CertificateData[] = [];
        let pageIndex = 0;

        while (true) {
          const page = (await queuePxeCall(() =>
            contract.methods
              .get_user_certificates_and_content(owner, pageIndex)
              .simulate({ from: owner })
          )) as UserCertificatesPageResult;

          if (page.count === 0) break;
          if (!isNotEmptyPage(page)) break;

          certificates.push(pageToCertificateData(page, ownerAddress));

          if (!page.has_more) break;
          pageIndex += 1;
        }

        return certificates;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        throw new Error(`Failed to load certificates: ${message}`, {
          cause: err instanceof Error ? err : undefined,
        });
      }
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
