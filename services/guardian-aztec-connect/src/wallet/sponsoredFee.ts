import { SPONSORED_FPC_SALT } from "@aztec-labs/constants";
import { getContractInstanceFromInstantiationParams, type ContractInstanceWithAddress } from "@aztec-labs/aztec.js/contracts";
import { Fr } from "@aztec-labs/aztec.js/fields";
import { SponsoredFPCContract } from "@aztec-labs/noir-contracts.js/SponsoredFPC";

export async function getSponsoredFPCInstance(): Promise<ContractInstanceWithAddress> {
    return await getContractInstanceFromInstantiationParams(SponsoredFPCContract.artifact, {
        salt: new Fr(SPONSORED_FPC_SALT),
    });
}
