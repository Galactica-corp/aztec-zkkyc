import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import { getContractInstanceFromInstantiationParams } from "@aztec/aztec.js/contracts";
import { ContractInstanceWithAddress } from "@aztec/stdlib/contract";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { NO_FROM } from "@aztec/aztec.js/account";
import { createAztecNodeClient } from "@aztec/aztec.js/node";
import { TokenContract } from "@aztec/noir-contracts.js/Token"
import { getAztecNodeUrl } from "../config/config.js";
import { EmbeddedWallet } from "@aztec/wallets/embedded";
import { getFeePaymentMethodForTxFees } from "../crates/zk_certificate/src/utils/fpc.js";

const nodeUrl = getAztecNodeUrl();
const node = createAztecNodeClient(nodeUrl)

const setupWallet1 = async () => {
    return await EmbeddedWallet.create(node, { ephemeral: true });
};

const setupWallet2 = async () => {
    return await EmbeddedWallet.create(node, { ephemeral: true });
};

const L2_TOKEN_CONTRACT_SALT = Fr.random();

export async function getL2TokenContractInstance(deployerAddress: any, ownerAztecAddress: AztecAddress): Promise<ContractInstanceWithAddress> {
    return await getContractInstanceFromInstantiationParams(
        TokenContract.artifact,
        {
            salt: L2_TOKEN_CONTRACT_SALT,
            deployer: deployerAddress,
            constructorArgs: [
                ownerAztecAddress,
                'Clean USDC',
                'USDC',
                6
            ]
        }
    )
}

async function main() {

    const wallet1 = await setupWallet1();
    const wallet2 = await setupWallet2();
    const { paymentMethod } = await getFeePaymentMethodForTxFees(wallet1);
    await getFeePaymentMethodForTxFees(wallet2);
    // deploy token contract

    let secretKey = Fr.random();
    let signingKey = GrumpkinScalar.random();
    let salt = Fr.random();
    let schnorrAccount = await wallet1.createSchnorrAccount(secretKey, salt, signingKey);
    await (await schnorrAccount.getDeployMethod()).send({ from: NO_FROM, fee: { paymentMethod } });
    let ownerAddress = schnorrAccount.address;
    const { contract: token } = await TokenContract.deploy(wallet1, ownerAddress, 'Clean USDC', 'USDC', 6, { salt: L2_TOKEN_CONTRACT_SALT }).send({
        from: ownerAddress,
        fee: { paymentMethod }
    });

    // setup account on 2nd pxe

    await wallet2.registerSender(ownerAddress, "owner")

    let secretKey2 = Fr.random();
    let signingKey2 = GrumpkinScalar.random();
    let salt2 = Fr.random();
    let schnorrAccount2 = await wallet2.createSchnorrAccount(secretKey2, salt2, signingKey2);

    // deploy account on 2nd pxe
    await (await schnorrAccount2.getDeployMethod()).send({ from: NO_FROM, fee: { paymentMethod } });
    let wallet2Address = schnorrAccount2.address;
    await wallet2.registerSender(ownerAddress, "owner")

    // mint to account on 2nd pxe

    const private_mint_tx = await token.methods.mint_to_private(schnorrAccount2.address, 100).send({
        from: ownerAddress,
        fee: { paymentMethod }
    });
    const receipt = await node.getTxReceipt(private_mint_tx.receipt.txHash, { includeTxEffect: true });
    if (receipt.isMined() && receipt.txEffect) {
        console.log(receipt.txEffect);
    } else {
        console.log(receipt);
    }
    await token.methods.mint_to_public(schnorrAccount2.address, 100).send({
        from: ownerAddress,
        fee: { paymentMethod }
    });


    // setup token on 2nd pxe

    const l2TokenContractInstance = await getL2TokenContractInstance(ownerAddress, ownerAddress)
    await wallet2.registerContract(l2TokenContractInstance, TokenContract.artifact)

    const l2TokenContract = await TokenContract.at(
        l2TokenContractInstance.address,
        wallet2
    )

    // returns 0n
    const balance = await l2TokenContract.methods.balance_of_private(wallet2Address).simulate({
        from: wallet2Address
    })
    console.log("private balance should be 100", balance)
    // errors
    await l2TokenContract.methods.balance_of_public(wallet2Address).simulate({
        from: wallet2Address
    })

}

main();
