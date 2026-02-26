import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import type { PrivateEvent } from '@aztec/aztec.js/wallet';
import { BasicDisclosureContract } from '../../../../../artifacts/BasicDisclosure';
import { useAztecWallet, hasAppManagedPXE } from '../../aztec-wallet';
import { queuePxeCall } from '../../utils';
import { queryKeys } from './queryKeys';

export type BasicDisclosureEventPayload = {
  from: AztecAddress;
  context: Fr;
  guardian: AztecAddress;
  unique_id: Fr;
};

interface UseDisclosureEventsOptions {
  enabled?: boolean;
}

interface UseDisclosureEventsReturn {
  events: PrivateEvent<BasicDisclosureEventPayload>[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Fetches BasicDisclosure private events scoped to the current account (recipient).
 * Only available when using Embedded or External Signer wallet (getPrivateEvents on Wallet).
 */
export const useDisclosureEvents = (
  options: UseDisclosureEventsOptions = {}
): UseDisclosureEventsReturn => {
  const { account, connector, currentConfig, isPXEInitialized } =
    useAztecWallet();
  const queryClient = useQueryClient();

  const contractAddress = currentConfig?.basicDisclosureContractAddress;
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
    queryFn: async (): Promise<PrivateEvent<BasicDisclosureEventPayload>[]> => {
      const wallet = connector!.getWallet();
      if (!wallet || !contractAddress || !account) {
        return [];
      }
      const filter = {
        contractAddress: AztecAddress.fromString(contractAddress),
        scopes: [account.getAddress()],
      };
      return queuePxeCall(() =>
        wallet.getPrivateEvents<BasicDisclosureEventPayload>(
          BasicDisclosureContract.events.BasicDisclosureEvent,
          filter
        )
      );
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
