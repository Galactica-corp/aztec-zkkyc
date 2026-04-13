import { PodRacingContract } from "../artifacts/PodRacing.js"
import { Logger, createLogger } from "@aztec/aztec.js/log";
import { setupWallet } from "../crates/zk_certificate/src/utils/setup_wallet.js";
import { getFeePaymentMethodForTxFees } from "../crates/zk_certificate/src/utils/fpc.js";
import { createAccountFromEnv } from "../crates/zk_certificate/src/utils/create_account_from_env.js";

async function main() {

    let logger: Logger;

    logger = createLogger('aztec:aztec-starter');

    const wallet = await setupWallet();

    const { paymentMethod } = await getFeePaymentMethodForTxFees(wallet);

    const accountManager = await createAccountFromEnv(wallet);
    const address = accountManager.address;

    const profileTx = await PodRacingContract.deploy(wallet, address).profile({ profileMode: "full", from: address });
    console.dir(profileTx, { depth: 2 });
}

main();
