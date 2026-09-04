import { Logger, createLogger } from "@aztec/aztec.js/log";
import { Fr } from "@aztec/aztec.js/fields";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { CertificateRegistryContract } from "../artifacts/CertificateRegistry.js";
import { setupWallet } from "../crates/zk_certificate/src/utils/setup_wallet.js";
import { getAccountFromEnv } from "../crates/zk_certificate/src/utils/create_account_from_env.js";
import { getContractInstanceFromInstantiationParams } from "@aztec/aztec.js/contracts";

async function main() {
    let logger: Logger;
    logger = createLogger('aztec:certificate-registry-existing');

    // Setup wallet
    const wallet = await setupWallet();

    // Get account from environment variables
    const accountManager = await getAccountFromEnv(wallet);
    const address = accountManager.address;

    // CI still writes POD_RACING_CONTRACT_ADDRESS from the first deployed contract (Certificate Registry).
    const contractAddress =
        process.env.CERTIFICATE_REGISTRY_CONTRACT_ADDRESS ??
        process.env.POD_RACING_CONTRACT_ADDRESS;
    if (!contractAddress) {
        logger.error("Please set CERTIFICATE_REGISTRY_CONTRACT_ADDRESS or POD_RACING_CONTRACT_ADDRESS with your deployed contract address");
        return;
    }

    logger.info(`Connecting to certificate registry contract at: ${contractAddress}`);
    // Get instantiation parameters from environment variables
    const contractSalt = process.env.CONTRACT_SALT;
    const contractDeployer = process.env.CONTRACT_DEPLOYER;
    const constructorArgsJson = process.env.CONTRACT_CONSTRUCTOR_ARGS;

    if (!contractSalt || !contractDeployer || !constructorArgsJson) {
        logger.error("Missing contract instantiation data in .env file");
        logger.error("Please ensure CONTRACT_SALT, CONTRACT_DEPLOYER, and CONTRACT_CONSTRUCTOR_ARGS are set");
        return;
    }

    logger.info("Reconstructing contract instance from environment variables...");

    // Parse constructor args
    let constructorArgs;
    try {
        // Clean the JSON string (handles both workflow and local usage)
        const cleanedJson = constructorArgsJson
            .trim()                           // Remove leading/trailing whitespace
            .replace(/^['"]|['"]$/g, '');     // Remove surrounding quotes from .env parsing

        constructorArgs = JSON.parse(cleanedJson).map((arg: string) => AztecAddress.fromStringUnsafe(arg));
    } catch (error) {
        logger.error(`Failed to parse constructor args: ${constructorArgsJson}`);
        logger.error(`Error: ${error}`);
        throw error;
    }

    const registryAddress = AztecAddress.fromStringUnsafe(contractAddress);

    const instance = await getContractInstanceFromInstantiationParams(CertificateRegistryContract.artifact, {
        constructorArgs,
        salt: Fr.fromString(contractSalt),
        deployer: AztecAddress.fromStringUnsafe(contractDeployer)
    });

    logger.info("✅ Contract instance reconstructed successfully");

    await wallet.registerContract(instance, CertificateRegistryContract.artifact);

    const certificateRegistry = await CertificateRegistryContract.at(
        registryAddress,
        wallet
    );

    const count = await certificateRegistry.methods.get_certificate_count(address).simulate({
        from: address,
    });
    logger.info(`Certificate count for ${address}: ${count.result}`);
}

main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
});
