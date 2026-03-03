import React, { useState } from 'react';
import { FileCheck, Puzzle, Wrench, Settings, Eye } from 'lucide-react';
import { useAztecWallet, isEmbeddedConnector } from '../aztec-wallet';
import { Tabs, SecurityWarning } from '../components';
import { TabConfig, TabType } from '../types';
import { iconSize } from '../utils';
import { CertificateRegistryCard } from './CertificateRegistryCard';
import { ContractInteractionCard } from './ContractInteractionCard';
import { UseCaseExampleCard } from './UseCaseExampleCard';
import { DisclosuresCard } from './DisclosuresCard';
import { SettingsCard } from './SettingsCard';

const styles = {
  main: 'flex flex-col gap-6',
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
      label: 'Use Case Example',
      icon: <Puzzle size={iconSize('md')} />,
      component: <UseCaseExampleCard />,
    },
    {
      id: 'contract',
      label: 'Contract UI',
      icon: <Wrench size={iconSize('md')} />,
      component: <ContractInteractionCard />,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings size={iconSize('md')} />,
      component: <SettingsCard />,
    },
  ];

  return (
    <main className={styles.main}>
      {showSecurityWarning && <SecurityWarning />}
      <Tabs tabs={tabs} defaultTab={activeTab} onTabChange={setActiveTab} />
    </main>
  );
};
