import * as dotenv from 'dotenv';
import { AztecAddress } from '@aztec/stdlib/aztec-address';

// Load environment variables
dotenv.config();

/**
 * Reads the certificate registry admin address from the environment.
 * Expects CERTIFICATE_REGISTRY_ADMIN_ADDRESS to be set in .env (hex string, e.g. "0x...").
 *
 * @returns The admin address as AztecAddress
 * @throws If CERTIFICATE_REGISTRY_ADMIN_ADDRESS is missing or invalid
 */
export function getCertificateRegistryAdminAddress(): AztecAddress {
  const value = process.env.CERTIFICATE_REGISTRY_ADMIN_ADDRESS;

  if (!value) {
    throw new Error(
      'CERTIFICATE_REGISTRY_ADMIN_ADDRESS environment variable is required. Please set it in your .env file.'
    );
  }

  try {
    return AztecAddress.fromString(value);
  } catch (error) {
    throw new Error(
      `Invalid CERTIFICATE_REGISTRY_ADMIN_ADDRESS format. Please ensure it is a valid hex string (e.g. "0x..."). ${error}`
    );
  }
}
