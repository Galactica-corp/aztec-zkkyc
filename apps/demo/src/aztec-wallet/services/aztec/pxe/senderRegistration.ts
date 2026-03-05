import { AztecAddress } from '@aztec/aztec.js/addresses';
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
