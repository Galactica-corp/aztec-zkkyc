/**
 * Deployable Contracts Configuration.
 * See docs/contract-ui.md for documentation.
 */
import ageCheckRequirementSandbox from '../../../../target/age_check_requirement-AgeCheckRequirement.json' with { type: 'json' };
import tokenDevnet from '../artifacts/devnet/token_contract-Token.json' with { type: 'json' };
import dripperSandbox from '../artifacts/sandbox/dripper-Dripper.json' with { type: 'json' };
import tokenSandbox from '../artifacts/sandbox/token_contract-Token.json' with { type: 'json' };
import {
  loadDeployableContracts,
  type DeployableContractConfig,
} from '../utils/deployableContracts';

/**
 * ==========================================
 * USER CONFIGURATION - Add new contracts here
 * ==========================================
 *
 * Each entry needs:
 *   - id: Unique identifier
 *   - label: Display name shown in UI
 *   - artifact: Imported artifact JSON
 *   - network: (optional) Filter by network name
 *   - labelField: (optional) Constructor param to distinguish multiple deployments (e.g., 'name' for Token)
 */
const DEPLOYABLE_CONTRACTS_CONFIG: DeployableContractConfig[] = [
  {
    id: 'token-devnet',
    label: 'Token Contract',
    artifact: tokenDevnet,
    network: 'devnet',
    labelField: 'name',
  },
  {
    id: 'token-sandbox',
    label: 'Token Contract',
    artifact: tokenSandbox,
    network: 'sandbox',
    labelField: 'name',
  },
  {
    id: 'dripper-sandbox',
    label: 'Dripper',
    artifact: dripperSandbox,
    network: 'sandbox',
  },
  {
    id: 'age-check-requirement-sandbox',
    label: 'Age Check Requirement',
    artifact: ageCheckRequirementSandbox,
    network: 'sandbox',
  },
];

/**
 * Processed deployable contracts with extracted constructors.
 * Do not modify - this is auto-generated from the config above.
 */
export const DEPLOYABLE_CONTRACTS = loadDeployableContracts(
  DEPLOYABLE_CONTRACTS_CONFIG
);
