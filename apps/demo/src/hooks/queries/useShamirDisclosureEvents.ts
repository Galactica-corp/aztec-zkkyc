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
      if (!wallet || !contractAddress || !account) {
        return [];
      }
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
        // Some deployments do not pre-register ShamirDisclosure in PXE.
        // Treat this as "no events available" instead of hard-failing the UI.
        if (isUnknownContractError(error) || isEmptyBlockRangeError(error)) {
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
