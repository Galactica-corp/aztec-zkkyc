import React from 'react';
import { AVAILABLE_NETWORKS } from '../../config/networks';
import type { AztecNetwork } from '../../config/networks/constants';
import type { NetworkConfig } from '../../config/networks/types';

interface ConfigDisplayProps {
    networkName: AztecNetwork;
}

interface ConfigField {
    key: keyof NetworkConfig;
    label: string;
    formatter?: (value: boolean) => string;
}

const CONFIG_FIELDS: ConfigField[] = [
    { key: 'nodeUrl', label: 'Node URL' },
    {
        key: 'certificateRegistryContractAddress',
        label: 'Certificate Registry Contract',
    },
    {
        key: 'certificateRegistryAdminAddress',
        label: 'Certificate Registry Admin',
    },
    { key: 'useCaseExampleContractAddress', label: 'Use Case Example Contract' },
    { key: 'deployerAddress', label: 'Deployer Address' },
    {
        key: 'certificateRegistryDeploymentSalt',
        label: 'Certificate Registry Salt',
    },
    { key: 'useCaseExampleDeploymentSalt', label: 'Use Case Example Salt' },
    {
        key: 'proverEnabled',
        label: 'Prover Enabled',
        formatter: (value: boolean) => (value ? 'Yes' : 'No'),
    },
];

const styles = {
    container: 'space-y-4',
    grid: 'space-y-3',
    row: 'flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4',
    label: 'text-sm font-semibold text-default sm:w-40 shrink-0',
    value:
        'flex-1 px-3 py-2 rounded-lg bg-surface-secondary border border-default text-sm text-secondary font-mono break-all',
} as const;

export const ConfigDisplay: React.FC<ConfigDisplayProps> = ({
    networkName,
}) => {
    const config = AVAILABLE_NETWORKS.find(
        (network) => network.name === networkName
    );

    if (!config) {
        return null;
    }

    return (
        <div className={styles.container}>
            <div className={styles.grid}>
                {CONFIG_FIELDS.map(({ key, label, formatter }) => {
                    const value = config[key];
                    const displayValue = formatter
                        ? formatter(value as boolean)
                        : value === undefined || value === null
                            ? 'Not configured'
                            : typeof value === 'object'
                                ? JSON.stringify(value)
                                : String(value);

                    return (
                        <div key={key} className={styles.row}>
                            <span className={styles.label}>{label}</span>
                            <span className={styles.value}>{displayValue}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
