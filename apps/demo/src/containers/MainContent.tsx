import React, { useState } from 'react';
import { FileCheck, Puzzle, Wrench, Settings, Eye, Coins } from 'lucide-react';
import { useAztecWallet, isEmbeddedConnector } from '../aztec-wallet';
import { Tabs, SecurityWarning } from '../components';
import { TabConfig, TabType } from '../types';
import { iconSize } from '../utils';
import { CertificateRegistryCard } from './CertificateRegistryCard';
import { ContractInteractionCard } from './ContractInteractionCard';
import { DisclosuresCard } from './DisclosuresCard';
import { SettingsCard } from './SettingsCard';
import { StablecoinCard } from './StablecoinCard';
import { UseCaseExampleCard } from './UseCaseExampleCard';

const styles = {
  main: 'flex flex-col gap-6',
  settingsTabTrigger: 'flex-none px-3',
  settingsTabLabel: 'sr-only',
} as const;

export const MainContent: React.FC = () => {
  const { connector } = useAztecWallet();
  const [activeTab, setActiveTab] = useState<TabType>('certificate-registry');

  // Show security warning for embedded wallet (stores keys in browser localStorage)
  const showSecurityWarning =
    connector?.getStatus().status === 'connected' &&
    isEmbeddedConnector(connector);

  const tabs: TabConfig[] = [
    {
      id: 'certificate-registry',
      label: 'Certificate Registry',
      icon: <FileCheck size={iconSize('md')} />,
      component: <CertificateRegistryCard />,
    },
    {
      id: 'disclosures',
      label: 'Disclosures',
      icon: <Eye size={iconSize('md')} />,
      component: <DisclosuresCard />,
    },
    {
      id: 'use-case-example',
      label: 'Use Case',
      icon: <Puzzle size={iconSize('md')} />,
      component: <UseCaseExampleCard />,
    },
    {
      id: 'contract',
      label: 'Contract',
      icon: <Wrench size={iconSize('md')} />,
      component: <ContractInteractionCard />,
    },
    {
      id: 'stablecoin',
      label: 'Stablecoin',
      icon: <Coins size={iconSize('md')} />,
      component: <StablecoinCard />,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings size={iconSize('md')} />,
      component: <SettingsCard />,
      triggerClassName: styles.settingsTabTrigger,
      labelClassName: styles.settingsTabLabel,
    },
  ];

  return (
    <main className={styles.main}>
      {showSecurityWarning && <SecurityWarning />}
      <Tabs tabs={tabs} defaultTab={activeTab} onTabChange={setActiveTab} />
    </main>
  );
};
