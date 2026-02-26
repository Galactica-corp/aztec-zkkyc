import { DefaultAccountContract } from '@aztec/accounts/defaults';
import type { ContractArtifact } from '@aztec/aztec.js/abi';
import type { AuthWitnessProvider } from '@aztec/aztec.js/account';
import type { CompleteAddress } from '@aztec/aztec.js/addresses';
import { EcdsaKEthSignerAccountContractArtifact } from '../../artifacts/EcdsaKEthSignerAccount';

/**
 * Account contract for ECDSA K accounts that use MetaMask's personal_sign for authentication.
 * Extends DefaultAccountContract (v4 API); getAccount() is provided by the base class.
 *
 * Unlike standard ECDSA accounts, this does NOT store private keys. It takes the public key
 * coordinates (x, y) and delegates signing to an external AuthWitnessProvider (MetaMask).
 * The Noir contract verifies Ethereum-style personal_sign (keccak256 + secp256k1).
 */
export class EcdsaKEthSignerAccountContract extends DefaultAccountContract {
  private readonly publicKeyX: Buffer;
  private readonly publicKeyY: Buffer;
  private readonly authWitnessProvider: AuthWitnessProvider;

  constructor(
    publicKeyX: Buffer,
    publicKeyY: Buffer,
    authWitnessProvider: AuthWitnessProvider
  ) {
    super();
    if (publicKeyX.length !== 32 || publicKeyY.length !== 32) {
      throw new Error('Public key coordinates must be 32 bytes each');
    }
    this.publicKeyX = publicKeyX;
    this.publicKeyY = publicKeyY;
    this.authWitnessProvider = authWitnessProvider;
  }

  getContractArtifact(): Promise<ContractArtifact> {
    return Promise.resolve(EcdsaKEthSignerAccountContractArtifact);
  }

  async getInitializationFunctionAndArgs(): Promise<{
    constructorName: string;
    constructorArgs: unknown[];
  }> {
    return {
      constructorName: 'constructor',
      constructorArgs: [
        Array.from(this.publicKeyX),
        Array.from(this.publicKeyY),
      ],
    };
  }

  getAuthWitnessProvider(_address: CompleteAddress): AuthWitnessProvider {
    return this.authWitnessProvider;
  }
}
