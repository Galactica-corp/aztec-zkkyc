// ============================================================================
// UI COMPONENT TYPES
// ============================================================================

export type TabType =
  | 'mint'
  | 'certificate-registry'
  | 'use-case-example'
  | 'settings'
  | 'contract'
  | 'components';

export interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ReactNode;
  component: React.ReactNode;
}
