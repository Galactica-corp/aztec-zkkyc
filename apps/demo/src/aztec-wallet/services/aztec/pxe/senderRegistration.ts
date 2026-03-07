import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import type { SharedPXEInstance } from './SharedPXEService';

type SenderAddressLike = AztecAddress | string;

function toAztecAddress(address: SenderAddressLike): AztecAddress {
  if (typeof address === 'string') {
    return AztecAddress.fromString(address);
  }
  return address;
}

/**
 * Register a sender address with PXE and persist it for future sessions.
 * This enables incoming private log sync for notes emitted by that sender.
 */
export async function registerAddressAsSender(
  pxeInstance: SharedPXEInstance,
  address: SenderAddressLike,
  context = 'senderRegistration'
): Promise<void> {
  const senderAddress = toAztecAddress(address);
  const senderAddressString = senderAddress.toString();

  try {
    await pxeInstance.pxe.registerSender(senderAddress);
    pxeInstance.storageService.addSender(senderAddressString);
  } catch (error) {
    // Non-fatal: sender sync may be delayed, but wallet usage can continue.
    console.warn(
      `[${context}] Failed to register sender ${senderAddressString}`,
      error
    );
  }
}

/**
 * Register all non-zero guardian addresses from the certificate registry
 * whitelist as PXE senders.
 *
 * The contract returns a fixed-size array (zero-padded), so this helper:
 * - skips zero entries,
 * - avoids duplicate registrations using persisted sender storage.
 */
export async function registerGuardianWhitelistAsSenders(
  pxeInstance: SharedPXEInstance,
  guardianWhitelist: bigint[],
  context = 'senderRegistration'
): Promise<void> {
  const knownSenders = new Set(pxeInstance.storageService.getSenders());

  for (const guardianField of guardianWhitelist) {
    if (guardianField === 0n) {
      continue;
    }

    const guardianAddress = AztecAddress.fromField(new Fr(guardianField));
    const guardianAddressString = guardianAddress.toString();

    if (knownSenders.has(guardianAddressString)) {
      continue;
    }

    await registerAddressAsSender(
      pxeInstance,
      guardianAddress,
      `${context}:guardianWhitelist`
    );
    knownSenders.add(guardianAddressString);
  }
}
