import React, { useState } from 'react';
import { Coins, FileCheck, Puzzle, Wrench, Settings, Layers } from 'lucide-react';
import { useAztecWallet, isEmbeddedConnector } from '../aztec-wallet';
import { Tabs, SecurityWarning } from '../components';
import { TabConfig, TabType } from '../types';
import { iconSize } from '../utils';
import { CertificateRegistryCard } from './CertificateRegistryCard';
import { ContractInteractionCard } from './ContractInteractionCard';
import { UseCaseExampleCard } from './UseCaseExampleCard';
import { DripperCard } from './DripperCard';
import { SettingsCard } from './SettingsCard';
import { UIComponentsShowcase } from './UIComponentsShowcase';

const styles = {
  main: 'flex flex-col gap-6',
} as const;

export const MainContent: React.FC = () => {
  const { connector } = useAztecWallet();
  const [activeTab, setActiveTab] = useState<TabType>('mint');

  // Show security warning for embedded wallet (stores keys in browser localStorage)
  const showSecurityWarning =
    connector?.getStatus().status === 'connected' &&
    isEmbeddedConnector(connector);

  const tabs: TabConfig[] = [
    {
      id: 'mint',
      label: 'Mint Tokens',
      icon: <Coins size={iconSize('md')} />,
      component: <DripperCard />,
    },
    {
      id: 'certificate-registry',
      label: 'Certificate Registry',
      icon: <FileCheck size={iconSize('md')} />,
      component: <CertificateRegistryCard />,
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
    {
      id: 'components',
      label: 'UI Components',
      icon: <Layers size={iconSize('md')} />,
      component: <UIComponentsShowcase />,
    },
  ];

  return (
    <main className={styles.main}>
      {showSecurityWarning && <SecurityWarning />}
      <Tabs tabs={tabs} defaultTab={activeTab} onTabChange={setActiveTab} />
    </main>
  );
};
