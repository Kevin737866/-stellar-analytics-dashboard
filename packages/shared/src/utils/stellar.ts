import { Asset, OperationType } from '../types/stellar';
import { Horizon } from '@stellar/stellar-sdk';

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
 * Parse asset string into Asset object
 */
export function parseAsset(assetString: string): Asset {
  if (assetString === 'XLM' || assetString === 'native') {
    return {
      asset_type: 'native',
      native: true,
    };
  }
  
  const [code, issuer] = assetString.split(':');
  if (!code || !issuer) {
    throw new Error(`Invalid asset format: ${assetString}`);
  }
  
  return {
    asset_type: code.length <= 4 ? 'credit_alphanum4' : 'credit_alphanum12',
    asset_code: code,
    asset_issuer: issuer,
  };
}

/**
 * Convert stroops to XLM
 */
export function stroopsToXlm(stroops: string | number): string {
  const stroopsNum = typeof stroops === 'string' ? BigInt(stroops) : BigInt(stroops);
  const xlm = Number(stroopsNum) / 10000000;
  return xlm.toFixed(7);
}

/**
 * Convert XLM to stroops
 */
export function xlmToStroops(xlm: string | number): string {
  const xlmNum = typeof xlm === 'string' ? parseFloat(xlm) : xlm;
  const stroops = Math.floor(xlmNum * 10000000);
  return stroops.toString();
}

/**
 * Format balance for display
 */
export function formatBalance(balance: string, asset?: Asset): string {
  if (!asset || asset.asset_type === 'native') {
    const xlm = stroopsToXlm(balance);
    return `${parseFloat(xlm).toLocaleString()} XLM`;
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

/**
 * Validate Stellar address
 */
export function isValidStellarAddress(address: string): boolean {
  try {
    return Horizon.AccountResponse.checkAddress(address);
  } catch {
    return false;
  }
}

/**
 * Validate Stellar secret key (seed)
 */
export function isValidStellarSecret(secret: string): boolean {
  try {
    const keypair = StellarKeypair.fromSecret(secret);
    return !!keypair.publicKey();
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

// Import Stellar SDK types
import * as StellarKeypair from '@stellar/stellar-sdk';
