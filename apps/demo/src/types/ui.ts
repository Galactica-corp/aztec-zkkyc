// ============================================================================
// UI COMPONENT TYPES
// ============================================================================

export type TabType =
  | 'certificate-registry'
  | 'disclosures'
  | 'use-case-example'
  | 'stablecoin'
  | 'settings'
  | 'contract'
  | 'components';

export interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ReactNode;
  component: React.ReactNode;
  triggerClassName?: string;
  labelClassName?: string;
}
