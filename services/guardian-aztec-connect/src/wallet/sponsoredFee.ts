import { SPONSORED_FPC_SALT } from "@aztec/constants";
import { getContractInstanceFromInstantiationParams, type ContractInstanceWithAddress } from "@aztec/aztec.js/contracts";
import { Fr } from "@aztec/aztec.js/fields";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";

export async function getSponsoredFPCInstance(): Promise<ContractInstanceWithAddress> {
    return await getContractInstanceFromInstantiationParams(SponsoredFPCContract.artifact, {
        salt: new Fr(SPONSORED_FPC_SALT),
    });
}
