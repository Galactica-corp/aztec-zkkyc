import { AztecAddress } from '@aztec/aztec.js/addresses';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { Fr } from '@aztec/aztec.js/fields';
import { createLogger } from '@aztec/aztec.js/log';
import type { AztecNode } from '@aztec/aztec.js/node';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { AztecSQLiteOPFSStore } from '@aztec/kv-store/sqlite-opfs';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { createPXE } from '@aztec/pxe/client/bundle';
import { getPXEConfig } from '@aztec/pxe/config';
import type { PXE } from '@aztec/pxe/server';
import { AVAILABLE_NETWORKS } from '../../../../config/networks';
import { FeePaymentRegister } from '../../../../services/aztec/feePayment/FeePaymentRegister';
import { MinimalWallet } from '../../../../utils/MinimalWallet';
import { NetworkService } from '../network';
import { AztecStorageService } from '../storage';
import type { AztecNetwork } from '../../../../config/networks/constants';
import { PXEInitError } from '../../wallet/errors';

const logger = createLogger('shared-pxe-service');
const pxeLogger = createLogger('pxe');

export interface SharedPXEInstance {
  pxe: PXE;
  aztecNode: AztecNode;
  wallet: MinimalWallet;
  storageService: AztecStorageService;
  getSponsoredFeePaymentMethod: () => Promise<SponsoredFeePaymentMethod>;
}

interface PXEInstanceEntry {
  instance: SharedPXEInstance;
  nodeUrl: string;
  networkName: AztecNetwork;
}

/**
 * SharedPXEService manages PXE instances across the application.
 * Uses singleton pattern with lazy initialization.
 */
class SharedPXEServiceClass {
  private instances: Map<string, PXEInstanceEntry> = new Map();
  private initPromises: Map<string, Promise<SharedPXEInstance>> = new Map();
  private cachedPaymentMethods: Map<string, SponsoredFeePaymentMethod> =
    new Map();
  private storePromises: Map<
    string,
    Promise<AztecSQLiteOPFSStore>
  > = new Map();

  /**
   * Get or create a PXE instance for a specific network.
   * If already initializing, returns the same promise to avoid duplicate initialization.
   */
  async getInstance(
    nodeUrl: string,
    networkName: AztecNetwork
  ): Promise<SharedPXEInstance> {
    const normalizedNodeUrl = this.normalizeNodeUrl(nodeUrl);
    const key = this.getInstanceKey(networkName);

    // Return existing instance if available
    const existing = this.instances.get(key);
    if (existing) {
      // Reuse if URL matches, else replace stale one for this network
      if (existing.nodeUrl === normalizedNodeUrl) {
        return existing.instance;
      }
      this.clearInstance(existing.nodeUrl, existing.networkName);
    }

    // Return in-progress initialization if exists
    const initPromise = this.initPromises.get(key);
    if (initPromise) {
      return initPromise;
    }

    // Start new initialization
    const promise = this.initializeInstance(
      normalizedNodeUrl,
      networkName,
      key
    );
    this.initPromises.set(key, promise);

    try {
      const instance = await promise;
      return instance;
    } finally {
      this.initPromises.delete(key);
    }
  }

  /**
   * Check if a PXE instance is initialized for a network
   */
  isInitialized(networkName: AztecNetwork): boolean {
    const key = this.getInstanceKey(networkName);
    return this.instances.has(key);
  }

  /**
   * Check if initialization is in progress for a network
   */
  isInitializing(networkName: AztecNetwork): boolean {
    const key = this.getInstanceKey(networkName);
    return this.initPromises.has(key);
  }

  /**
   * Get existing instance without initialization (returns null if not initialized)
   */
  getExistingInstance(
    nodeUrl: string,
    networkName: AztecNetwork
  ): SharedPXEInstance | null {
    const key = this.getInstanceKey(networkName);
    return this.instances.get(key)?.instance ?? null;
  }

  /**
   * Clear a specific PXE instance (useful for network switching)
   */
  clearInstance(nodeUrl: string, networkName: AztecNetwork): void {
    const key = this.getInstanceKey(networkName);
    this.instances.delete(key);
    this.cachedPaymentMethods.delete(key);
    logger.info(`Cleared PXE instance for ${networkName}`);
  }

  /**
   * Clear all PXE instances
   */
  clearAll(): void {
    this.instances.clear();
    this.cachedPaymentMethods.clear();
    logger.info('Cleared all PXE instances');
  }

  private getInstanceKey(networkName: AztecNetwork | string): string {
    return `${networkName}`;
  }

  private getFeePaymentConfig(networkName: string) {
    const networkConfig = AVAILABLE_NETWORKS.find(
      (n) => n.name === networkName
    );
    return networkConfig?.feePaymentContracts;
  }

  private getNetworkConfig(networkName: string) {
    return AVAILABLE_NETWORKS.find((n) => n.name === networkName);
  }

  private normalizeNodeUrl(nodeUrl: string): string {
    if (!nodeUrl) {
      return nodeUrl;
    }
    return nodeUrl.endsWith('/') ? nodeUrl.slice(0, -1) : nodeUrl;
  }

  private async initializeInstance(
    nodeUrl: string,
    networkName: AztecNetwork,
    key: string
  ): Promise<SharedPXEInstance> {
    logger.info(`Initializing PXE for network: ${networkName}`);

    const aztecNode = NetworkService.getNodeClient(nodeUrl);

    let nodeInfo: Awaited<ReturnType<typeof aztecNode.getNodeInfo>>;
    try {
      nodeInfo = await aztecNode.getNodeInfo();
    } catch (cause) {
      throw new PXEInitError(
        `Failed to fetch node info from nodeUrl=${nodeUrl} for network ${networkName}`,
        cause
      );
    }

    const storeName = `aztec-pxe-${networkName}`;

    let pxeStore: AztecSQLiteOPFSStore;
    try {
      // Reuse a single store per network
      pxeStore = await this.getOrCreateStore(networkName, storeName);
    } catch (cause) {
      throw new PXEInitError(
        `Failed to initialize local PXE store "${storeName}" for network ${networkName}`,
        cause
      );
    }

    const config = getPXEConfig();
    config.l1ChainId = nodeInfo.l1ChainId;
    config.rollupVersion = nodeInfo.rollupVersion;
    config.rollupAddress = nodeInfo.l1ContractAddresses.rollupAddress;
    // Use network-specific prover mode. Public testnet requires real proofs, sandbox doesn't.
    const networkConfig = this.getNetworkConfig(networkName);
    config.proverEnabled = networkConfig?.proverEnabled ?? false;

    let pxe: PXE;
    try {
      pxe = await createPXE(aztecNode, config, {
        store: pxeStore,
        loggerActorLabel: `pxe-${networkName}`,
      });
    } catch (cause) {
      throw new PXEInitError(
        `Failed to create PXE instance for network ${networkName} (nodeUrl=${nodeUrl})`,
        cause
      );
    }

    const wallet = new MinimalWallet(pxe, aztecNode);

    // Register fee payment contracts (look up config by network name)
    try {
      const feePaymentConfig = this.getFeePaymentConfig(networkName);
      const feePaymentRegister = new FeePaymentRegister();
      await feePaymentRegister.registerAll(pxe, feePaymentConfig);
    } catch (cause) {
      throw new PXEInitError(
        `Failed to register fee payment contracts for network ${networkName}`,
        cause
      );
    }

    // Initialize storage service
    const storageService = new AztecStorageService();

    // Register saved senders
    try {
      await this.registerSavedSenders(pxe, storageService);
    } catch (cause) {
      throw new PXEInitError(
        `Failed to register saved senders for network ${networkName}`,
        cause
      );
    }

    try {
      logger.info(`PXE connected to ${networkName}`, nodeInfo);
    } catch (cause) {
      throw new PXEInitError(
        `PXE initialized, but failed to log node info for network ${networkName}`,
        cause
      );
    }

    const instance: SharedPXEInstance = {
      pxe,
      aztecNode,
      wallet,
      storageService,
      getSponsoredFeePaymentMethod: () =>
        this.getSponsoredFeePaymentMethod(key, pxe),
    };

    this.instances.set(key, {
      instance,
      nodeUrl,
      networkName,
    });

    return instance;
  }

  private async getOrCreateStore(
    networkName: AztecNetwork,
    storeName: string
  ): Promise<AztecSQLiteOPFSStore> {
    const existingPromise = this.storePromises.get(networkName);
    if (existingPromise) {
      return existingPromise;
    }

    const createPromise = this.createPXEStoreWithFallback(storeName);
    this.storePromises.set(networkName, createPromise);
    return createPromise;
  }

  /**
   * Open a persistent OPFS SQLite store. A second tab that already holds the
   * exclusive OPFS lock will fail, so we fall back to an ephemeral in-memory store.
   */
  private async createPXEStoreWithFallback(
    storeName: string
  ): Promise<AztecSQLiteOPFSStore> {
    try {
      return await AztecSQLiteOPFSStore.open(
        pxeLogger,
        storeName,
        false,
        `aztec-wallet-data/${storeName}`
      );
    } catch (error) {
      logger.warn(
        `Failed to create persistent PXE store "${storeName}". Retrying with an ephemeral store (another tab may hold the OPFS lock).`,
        { error }
      );

      return await AztecSQLiteOPFSStore.open(
        pxeLogger,
        `${storeName}-tmp`,
        true
      );
    }
  }

  private async getSponsoredPFCContract(_pxe: PXE) {
    const { getContractInstanceFromInstantiationParams } = await import(
      '@aztec/aztec.js/contracts'
    );

    return await getContractInstanceFromInstantiationParams(
      SponsoredFPCContractArtifact,
      {
        salt: new Fr(SPONSORED_FPC_SALT),
      }
    );
  }

  private async getSponsoredFeePaymentMethod(
    key: string,
    pxe: PXE
  ): Promise<SponsoredFeePaymentMethod> {
    const cached = this.cachedPaymentMethods.get(key);
    if (cached) {
      return cached;
    }

    const sponsoredPFCContract = await this.getSponsoredPFCContract(pxe);
    const paymentMethod = new SponsoredFeePaymentMethod(
      sponsoredPFCContract.address
    );

    this.cachedPaymentMethods.set(key, paymentMethod);

    return paymentMethod;
  }

  private async registerSavedSenders(
    pxe: PXE,
    storageService: AztecStorageService
  ): Promise<void> {
    try {
      const savedSenders = storageService.getSenders();

      if (savedSenders.length === 0) {
        return;
      }

      logger.info(`Registering ${savedSenders.length} saved senders with PXE`);

      for (const senderAddressString of savedSenders) {
        try {
          const senderAddress = AztecAddress.fromStringUnsafe(senderAddressString);
          await pxe.registerTaggingSecretSource({
            kind: 'address-derived',
            sender: senderAddress,
          });
        } catch {
          // Sender might already be registered
          logger.warn(`Failed to register sender ${senderAddressString}`);
        }
      }
    } catch (error) {
      logger.error('Error registering saved senders:', error);
    }
  }
}

// Export singleton instance
export const SharedPXEService = new SharedPXEServiceClass();
