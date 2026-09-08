import {
    createWalletClient,
    http,
} from 'viem';
import { foundry } from 'viem/chains'
import { mnemonicToAccount } from 'viem/accounts';
import { FeeJuiceContract } from "@aztec/noir-contracts.js/FeeJuice";
import { FPCContract } from "@aztec/noir-contracts.js/FPC";
import { TokenContract } from "@aztec/noir-contracts.js/Token";
import { createEthereumChain } from '@aztec/ethereum/chain';
import { createExtendedL1Client } from '@aztec/ethereum/client';
import { setupWallet } from "../crates/zk_certificate/src/utils/setup_wallet.js";
import { createAccountFromEnv } from "../crates/zk_certificate/src/utils/create_account_from_env.js";
import { Logger, createLogger } from '@aztec/aztec.js/log';
import { FeeJuicePaymentMethodWithClaim, PrivateFeePaymentMethod, PublicFeePaymentMethod } from '@aztec/aztec.js/fee';
import { Fr, GrumpkinScalar } from '@aztec/aztec.js/fields';
import { L1FeeJuicePortalManager } from '@aztec/aztec.js/ethereum';
import { isL1ToL2MessageReady } from '@aztec/aztec.js/messaging';
import { getCanonicalFeeJuice } from '@aztec/protocol-contracts/fee-juice';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { NO_FROM } from "@aztec/aztec.js/account";
import { getAztecNodeUrl } from '../config/config.js';
import { Gas, GasSettings } from '@aztec/stdlib/gas';
import { getFeePaymentMethodForTxFees } from "../crates/zk_certificate/src/utils/fpc.js";

const MNEMONIC = 'test test test test test test test test test test test junk';
const FEE_FUNDING_FOR_TESTER_ACCOUNT = 1000000000000000000000n;
async function waitForClaimableMessage(
    node: ReturnType<typeof createAztecNodeClient>,
    logger: Logger,
    messageHash: `0x${string}`,
    advanceChain: () => Promise<void>,
): Promise<void> {
    const message = Fr.fromString(messageHash);
    for (let attempt = 1; attempt <= 40; attempt++) {
        if (await isL1ToL2MessageReady(node, message, 'proven')) {
            logger.info(`L1 to L2 message is ready at the proven tip (attempt ${attempt})`);
            return;
        }
        logger.info(`Advancing chain until L1 to L2 message is proven (attempt ${attempt})`);
        await advanceChain();
    }
    throw new Error(`L1 to L2 message ${messageHash} was not proven after advancing the chain`);
}

async function main() {

    let logger: Logger;

    logger = createLogger('aztec:aztec-starter');

    const wallet = await setupWallet();
    const nodeUrl = getAztecNodeUrl();
    const node = createAztecNodeClient(nodeUrl);
    const nodeInfo = await node.getNodeInfo();

    const chain = createEthereumChain(['http://localhost:8545'], nodeInfo.l1ChainId);
    const l1Client = createExtendedL1Client(chain.rpcUrls, MNEMONIC, chain.chainInfo);

    // Setup Schnorr AccountManager

    const account1 = await createAccountFromEnv(wallet);

    let secretKey = Fr.random();
    let signingKey = GrumpkinScalar.random();
    let salt = Fr.random();
    let account2 = await wallet.createSchnorrAccount(secretKey, salt, signingKey);
    const feeJuiceRecipient = account2.address;

    // Setup and bridge fee asset to L2 to get fee juice

    const feeJuicePortalManager = await L1FeeJuicePortalManager.new(
        node,
        l1Client,
        logger,
    );

    const claim = await feeJuicePortalManager.bridgeTokensPublic(feeJuiceRecipient, FEE_FUNDING_FOR_TESTER_ACCOUNT, true);

    logger.info(`Fee Juice minted to ${feeJuiceRecipient} on L2.`)

    // set up sponsored fee payments
    const { paymentMethod } = await getFeePaymentMethodForTxFees(wallet);

    // Two arbitrary txs to make the L1 message available on L2
    await TokenContract.deploy(wallet, account1.address, "paddingCoin", "PAD", 18).send({
        from: account1.address,
        fee: { paymentMethod }
    });
    const { contract: bananaCoin } = await TokenContract.deploy(wallet, account1.address, "bananaCoin", "BNC", 18).send({
        from: account1.address,
        fee: { paymentMethod }
    });

    logger.info('Waiting for L1 to L2 fee juice message to be ready...');
    await waitForClaimableMessage(node, logger, claim.messageHash, async () => {
        await bananaCoin.methods.mint_to_public(account1.address, 1).send({
            from: account1.address,
            fee: { paymentMethod }
        });
    });

    // Claim Fee Juice & Pay Fees yourself

    const claimAndPay = new FeeJuicePaymentMethodWithClaim(account2.address, claim)
    await (await account2.getDeployMethod()).send({ from: NO_FROM, fee: { paymentMethod: claimAndPay } })
    logger.info(`New account at ${account2.address} deployed using claimed funds for fees.`)

    // Pay fees yourself

    await bananaCoin.methods.mint_to_public(account2.address, 1).send({
        from: account1.address,
        fee: { paymentMethod }
    })
    logger.info(`Minted from new account, paying fees via newWallet.`)

    // Private Fee Payments via FPC

    // Must use a Fee Paying Contract (FPC) to pay fees privately
    // Need to deploy an FPC to use Private Fee payment methods

    // This uses bananaCoin as the fee paying asset that will be exchanged for fee juice
    const { contract: fpc } = await FPCContract.deploy(wallet, bananaCoin.address, account1.address).send({
        from: account1.address,
        fee: { paymentMethod }
    })
    const fpcClaim = await feeJuicePortalManager.bridgeTokensPublic(fpc.address, FEE_FUNDING_FOR_TESTER_ACCOUNT, true);
    // 2 public txs to make the bridged fee juice available
    // Mint some bananaCoin and send to the newWallet to pay fees privately
    await bananaCoin.methods.mint_to_private(account2.address, FEE_FUNDING_FOR_TESTER_ACCOUNT).send({
        from: account1.address,
        fee: { paymentMethod }
    })
    // mint some public bananaCoin to the newWallet to pay fees publicly
    await bananaCoin.methods.mint_to_public(account2.address, FEE_FUNDING_FOR_TESTER_ACCOUNT).send({
        from: account1.address,
        fee: { paymentMethod }
    })

    logger.info('Waiting for FPC fee juice message to be ready...');
    await waitForClaimableMessage(node, logger, fpcClaim.messageHash, async () => {
        await bananaCoin.methods.mint_to_public(account1.address, 1).send({
            from: account1.address,
            fee: { paymentMethod }
        });
    });
    const bananaBalance = await bananaCoin.methods.balance_of_private(account2.address).simulate({
        from: account2.address
    })

    logger.info(`BananaCoin balance of newWallet is ${bananaBalance.result}`)

    const feeJuiceInstance = await getCanonicalFeeJuice();
    await wallet.registerContract(feeJuiceInstance.instance, FeeJuiceContract.artifact)
    const feeJuice = await FeeJuiceContract.at(feeJuiceInstance.address, wallet)

    await feeJuice.methods.claim(fpc.address, fpcClaim.claimAmount, fpcClaim.claimSecret, fpcClaim.messageLeafIndex).send({ from: account2.address })

    const fpcFeeJuiceBalance = await feeJuice.methods.balance_of_public(fpc.address).simulate({
        from: account2.address
    })
    logger.info(`Fpc fee juice balance ${fpcFeeJuiceBalance.result}`)

    const maxFeesPerGas = (await node.getCurrentMinFees()).mul(1.5);
    const gasSettings = GasSettings.fallback({
        gasLimits: Gas.from(nodeInfo.txsLimits.gas),
        maxFeesPerGas,
    });

    const privateFee = new PrivateFeePaymentMethod(fpc.address, account2.address, wallet, gasSettings)
    await bananaCoin.methods.transfer_in_private(account2.address, account1.address, 10, 0).send({
        from: account2.address,
        fee: { paymentMethod: privateFee }
    })

    logger.info(`Transfer paid with fees via the FPC, privately.`)

    // Public Fee Payments via FPC

    const publicFee = new PublicFeePaymentMethod(fpc.address, account2.address, wallet, gasSettings)
    await bananaCoin.methods.transfer_in_private(account2.address, account1.address, 10, 0).send({
        from: account2.address,
        fee: { paymentMethod: publicFee }
    })
    logger.info(`Transfer paid with fees via the FPC, publicly.`)

    // Sponsored Fee Payment

    // This method will only work in environments where there is a sponsored fee contract deployed
    if (process.env.AZTEC_ENV !== 'mainnet') {
        await bananaCoin.methods.transfer_in_private(account2.address, account1.address, 10, 0).send({
            from: account2.address,
            fee: { paymentMethod }
        })
        logger.info(`Transfer paid with fees from Sponsored FPC.`)
    }
}

main();

// from here: https://github.com/AztecProtocol/aztec-packages/blob/ecbd59e58006533c8885a8b2fadbd9507489300c/yarn-project/end-to-end/src/fixtures/utils.ts#L534
function getL1WalletClient(rpcUrl: string, index: number) {
    const hdAccount = mnemonicToAccount(MNEMONIC, { addressIndex: index });
    return createWalletClient({
        account: hdAccount,
        chain: foundry,
        transport: http(rpcUrl),
    });
}
