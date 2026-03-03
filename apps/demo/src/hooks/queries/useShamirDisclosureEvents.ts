import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import type { PrivateEvent } from '@aztec/aztec.js/wallet';
import { ShamirDisclosureContract } from '../../../../../artifacts/ShamirDisclosure';
import { useAztecWallet, hasAppManagedPXE } from '../../aztec-wallet';
import { queuePxeCall } from '../../utils';
import { queryKeys } from './queryKeys';

export type ShamirDisclosureShardEventPayload = {
  from: AztecAddress;
  context: Fr;
  shard_x: Fr;
  shard_y: Fr;
};

const ZERO_ADDRESS =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

interface UseShamirDisclosureEventsOptions {
  enabled?: boolean;
}

interface UseShamirDisclosureEventsReturn {
  events: PrivateEvent<ShamirDisclosureShardEventPayload>[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const isUnknownContractError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('Unknown contract') &&
    message.includes('add it to PXE by calling server.addContracts')
  );
};

const isEmptyBlockRangeError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('toBlock must be strictly greater than fromBlock');
};

const ensureShamirContractRegistered = async (
  pxe: ReturnType<NonNullable<ReturnType<typeof useAztecWallet>['connector']>['getPXE']>,
  contractAddress: string,
  currentConfig: NonNullable<ReturnType<typeof useAztecWallet>['currentConfig']>
): Promise<void> => {
  const expectedAddress = AztecAddress.fromString(contractAddress);

  try {
    const existing = await pxe.getContractInstance(expectedAddress);
    if (existing) return;
  } catch {
    // Continue with registration attempt.
  }

  const constructorArgs = currentConfig.shamirDisclosureConstructorArgs;
  const hasConstructorData =
    constructorArgs.recipientCount > 0 &&
    constructorArgs.threshold > 0 &&
    constructorArgs.recipients.every(
      (value) => value && value !== ZERO_ADDRESS
    ) &&
    constructorArgs.participantAddresses.every(
      (value) => value && value !== ZERO_ADDRESS
    );

  if (!hasConstructorData) {
    throw new Error(
      'Missing Shamir constructor metadata in deployment config. Re-run `yarn deploy` from repo root.'
    );
  }

  const { getContractInstanceFromInstantiationParams } = await import(
    '@aztec/aztec.js/contracts'
  );

  const deployerAddress = AztecAddress.fromString(currentConfig.deployerAddress);
  const instance = await getContractInstanceFromInstantiationParams(
    ShamirDisclosureContract.artifact,
    {
      salt: Fr.fromString(currentConfig.shamirDisclosureDeploymentSalt),
      deployer: deployerAddress,
      constructorArgs: [
        constructorArgs.recipientCount,
        constructorArgs.threshold,
        ...constructorArgs.recipients.map((value) => AztecAddress.fromString(value)),
        ...constructorArgs.participantAddresses.map((value) =>
          AztecAddress.fromString(value)
        ),
      ],
      constructorArtifact: 'constructor',
    }
  );

  if (!instance.address.equals(expectedAddress)) {
    throw new Error(
      `Shamir constructor mismatch. Computed ${instance.address.toString()} but deployment expects ${expectedAddress.toString()}.`
    );
  }

  await pxe.registerContract({
    instance,
    artifact: ShamirDisclosureContract.artifact,
  });
};

/**
 * Fetches ShamirDisclosure private events scoped to the current account (recipient).
 * Only available when using Embedded or External Signer wallet (getPrivateEvents on Wallet).
 */
export const useShamirDisclosureEvents = (
  options: UseShamirDisclosureEventsOptions = {}
): UseShamirDisclosureEventsReturn => {
  const { account, connector, currentConfig, isPXEInitialized } =
    useAztecWallet();
  const queryClient = useQueryClient();

  const contractAddress = currentConfig?.shamirDisclosureContractAddress;
  const scopeAddress = account?.getAddress().toString() ?? '';

  const canFetch =
    hasAppManagedPXE(connector) &&
    isPXEInitialized &&
    account &&
    contractAddress &&
    scopeAddress &&
    (options.enabled ?? true);

  const query = useQuery({
    queryKey: queryKeys.disclosureEvents.list(contractAddress ?? '', scopeAddress),
    queryFn: async (): Promise<PrivateEvent<ShamirDisclosureShardEventPayload>[]> => {
      const wallet = connector!.getWallet();
      const pxe = connector!.getPXE();
      if (!wallet || !pxe || !contractAddress || !account || !currentConfig) {
        return [];
      }

      await ensureShamirContractRegistered(pxe, contractAddress, currentConfig);

      const filter = {
        contractAddress: AztecAddress.fromString(contractAddress),
        scopes: [account.getAddress()],
      };
      try {
        const events = await queuePxeCall(() =>
          wallet.getPrivateEvents<ShamirDisclosureShardEventPayload>(
            ShamirDisclosureContract.events.ShamirDisclosureShardEvent,
            filter
          )
        );
        return events;
      } catch (error) {
        // PXE can throw for an empty block interval while indexing catches up.
        if (isEmptyBlockRangeError(error)) {
          return [];
        }
        throw error;
      }
    },
    enabled: canFetch,
    staleTime: 30_000,
  });

  const refetch = async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.disclosureEvents.list(
        contractAddress ?? '',
        scopeAddress
      ),
    });
  };

  return {
    events: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error as Error | null,
    refetch,
  };
};
