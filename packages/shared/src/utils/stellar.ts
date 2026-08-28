import { Asset, OperationType } from '../types/stellar';
import { Horizon, StrKey } from '@stellar/stellar-sdk';
import { AssetCodeSchema, AddressSchema } from './validation';

/**
 * Format asset to a standardized string representation
 */
export function formatAsset(asset: Asset): string {
  if (asset.asset_type === 'native') {
    return 'XLM';
  }
  return `${asset.asset_code}:${asset.asset_issuer}`;
}

/**
 * Parse asset string into Asset object.
 *
 * Accepts `XLM`, `native`, or `CODE:ISSUER` where CODE is 1–12 alphanumeric
 * characters and ISSUER is a valid Stellar account address (G…).
 */
export function parseAsset(assetString: string): Asset {
  const trimmed = assetString.trim();

  if (!trimmed) {
    throw new Error('Invalid asset format: empty string');
  }

  if (trimmed === 'XLM' || trimmed === 'native') {
    return {
      asset_type: 'native',
      native: true,
    };
  }

  const colonIndex = trimmed.indexOf(':');
  if (colonIndex === -1 || trimmed.indexOf(':', colonIndex + 1) !== -1) {
    throw new Error(`Invalid asset format: ${assetString}`);
  }

  const code = trimmed.slice(0, colonIndex);
  const issuer = trimmed.slice(colonIndex + 1);

  if (!code || !issuer) {
    throw new Error(`Invalid asset format: ${assetString}`);
  }

  AssetCodeSchema.parse(code);
  if (!/^[A-Za-z0-9]+$/.test(code)) {
    throw new Error(`Invalid asset code: ${code}`);
  }
  AddressSchema.parse(issuer);

  return {
    asset_type: code.length <= 4 ? 'credit_alphanum4' : 'credit_alphanum12',
    asset_code: code,
    asset_issuer: issuer,
  };
}

export * from './stroop';
import { stroopsToXlm } from './stroop';

/**
 * Format balance for display
 */
export function formatBalance(balance: string, asset?: Asset): string {
  if (!asset || asset.asset_type === 'native') {
    const xlm = stroopsToXlm(balance);
    const [whole, frac] = xlm.split('.');
    const formattedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${formattedWhole}.${frac} XLM`;
  }

  const numBalance = parseFloat(balance);
  return `${numBalance.toLocaleString()} ${asset.asset_code}`;
}

/**
 * Get operation type display name
 */
export function getOperationTypeName(type: OperationType): string {
  const typeNames: Record<OperationType, string> = {
    create_account: 'Create Account',
    payment: 'Payment',
    path_payment_strict_receive: 'Path Payment (Strict Receive)',
    path_payment_strict_send: 'Path Payment (Strict Send)',
    manage_sell_offer: 'Manage Sell Offer',
    manage_buy_offer: 'Manage Buy Offer',
    create_passive_sell_offer: 'Create Passive Sell Offer',
    set_options: 'Set Options',
    change_trust: 'Change Trust',
    allow_trust: 'Allow Trust',
    account_merge: 'Account Merge',
    inflation: 'Inflation',
    manage_data: 'Manage Data',
    bump_sequence: 'Bump Sequence',
    claim_claimable_balance: 'Claim Claimable Balance',
    begin_sponsoring_future_reserves: 'Begin Sponsoring Future Reserves',
    end_sponsoring_future_reserves: 'End Sponsoring Future Reserves',
    revoke_sponsorship: 'Revoke Sponsorship',
    clawback: 'Clawback',
    clawback_claimable_balance: 'Clawback Claimable Balance',
    set_trust_line_flags: 'Set Trust Line Flags',
    liquidity_pool_deposit: 'Liquidity Pool Deposit',
    liquidity_pool_withdraw: 'Liquidity Pool Withdraw',
    invoke_host_function: 'Invoke Host Function',
  };

  return typeNames[type] || type;
}

export interface ValidateAddressOptions {
  /** Allow multiplexed (M...) Stellar account addresses */
  allowMuxed?: boolean;
  /** Allow contract (C...) addresses */
  allowContract?: boolean;
}

/**
 * Validate Stellar address.
 *
 * Checks if the string is a valid Stellar public key address.
 * Standard Ed25519 public keys ('G...') are always checked.
 * Optionally allows multiplexed ('M...') or contract ('C...') addresses.
 */
export function isValidStellarAddress(
  address: string,
  options: ValidateAddressOptions = {}
): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }

  const trimmed = address.trim();
  if (StrKey.isValidEd25519PublicKey(trimmed)) {
    return true;
  }

  if (options.allowMuxed && StrKey.isValidMed25519PublicKey(trimmed)) {
    return true;
  }

  if (options.allowContract && StrKey.isValidContract(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Validate Stellar address and return the trimmed address, or throw an error.
 */
export function validateStellarAddress(address: string, options?: ValidateAddressOptions): string {
  if (!isValidStellarAddress(address, options)) {
    throw new Error(`Invalid Stellar address: ${address}`);
  }
  return address.trim();
}

/**
 * Validate Stellar secret key (seed)
 */
export function isValidStellarSecret(secret: string): boolean {
  if (!secret || typeof secret !== 'string') {
    return false;
  }
  try {
    return StrKey.isValidEd25519SecretSeed(secret.trim());
  } catch {
    return false;
  }
}

/**
 * Calculate percentage change
 */
export function calculatePercentageChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return newValue > 0 ? 100 : 0;
  return ((newValue - oldValue) / oldValue) * 100;
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Format duration between two timestamps
 */
export function formatDuration(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end.getTime() - start.getTime();

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Truncate address for display
 */
export function truncateAddress(address: string, startChars = 6, endChars = 4): string {
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Debounce function for API calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
