/**
 * Issue #500 – Shared: Validate Stellar addresses.
 *
 * Validates Ed25519 public keys, StrKey checksum verification, secret seeds,
 * and optional support for multiplexed and contract addresses.
 */

import { Keypair, StrKey } from '@stellar/stellar-sdk';
import {
  isValidStellarAddress,
  validateStellarAddress,
  isValidStellarSecret,
} from '../../../packages/shared/src/utils/stellar';

describe('Stellar Address Validation (Issue #500)', () => {
  const VALID_G_ADDRESS = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
  const VALID_SECRET = 'SCZANGBA5YHTNYVVV4C3U252E2B6P6F5T3U6MM63WBSBZATAQI3EBTQ4';

  it('validates standard Ed25519 public key addresses (G...)', () => {
    expect(isValidStellarAddress(VALID_G_ADDRESS)).toBe(true);
    expect(validateStellarAddress(VALID_G_ADDRESS)).toBe(VALID_G_ADDRESS);

    // Test with whitespace padding
    expect(isValidStellarAddress(`  ${VALID_G_ADDRESS}  `)).toBe(true);
    expect(validateStellarAddress(`  ${VALID_G_ADDRESS}  `)).toBe(VALID_G_ADDRESS);

    // Test multiple dynamically generated keypairs
    for (let i = 0; i < 20; i++) {
      const kp = Keypair.random();
      expect(isValidStellarAddress(kp.publicKey())).toBe(true);
      expect(validateStellarAddress(kp.publicKey())).toBe(kp.publicKey());
      expect(isValidStellarSecret(kp.secret())).toBe(true);
    }
  });

  it('rejects addresses with invalid checksums', () => {
    // Modify the final character to corrupt CRC16 checksum
    const corrupted = VALID_G_ADDRESS.slice(0, -1) + (VALID_G_ADDRESS.endsWith('N') ? 'M' : 'N');
    expect(isValidStellarAddress(corrupted)).toBe(false);
    expect(() => validateStellarAddress(corrupted)).toThrow(/Invalid Stellar address/);
  });

  it('rejects malformed, wrong-length, and non-base32 addresses', () => {
    // Too short
    expect(isValidStellarAddress('GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZ')).toBe(
      false
    );
    // Too long
    expect(isValidStellarAddress(`${VALID_G_ADDRESS}A`)).toBe(false);
    // Lowercase
    expect(isValidStellarAddress(VALID_G_ADDRESS.toLowerCase())).toBe(false);
    // Invalid characters (e.g. 1, 8, 0, punctuation)
    expect(isValidStellarAddress(`GA${'1'.repeat(54)}`)).toBe(false);
    expect(isValidStellarAddress(`GA${'@'.repeat(54)}`)).toBe(false);

    expect(() => validateStellarAddress('not-an-address')).toThrow(/Invalid Stellar address/);
  });

  it('rejects empty, null, and non-string inputs safely', () => {
    expect(isValidStellarAddress('')).toBe(false);
    expect(isValidStellarAddress('   ')).toBe(false);
    expect(isValidStellarAddress(null as any)).toBe(false);
    expect(isValidStellarAddress(undefined as any)).toBe(false);
    expect(isValidStellarAddress(123456 as any)).toBe(false);

    expect(() => validateStellarAddress('')).toThrow(/Invalid Stellar address/);
    expect(() => validateStellarAddress(null as any)).toThrow(/Invalid Stellar address/);
  });

  it('handles multiplexed (M...) addresses according to options', () => {
    // Generate valid Med25519 multiplexed address (32-byte pubkey + 8-byte id)
    const pubKey = StrKey.decodeEd25519PublicKey(VALID_G_ADDRESS);
    const medAddress = StrKey.encodeMed25519PublicKey(Buffer.concat([pubKey, Buffer.alloc(8)]));

    // Disallowed by default
    expect(isValidStellarAddress(medAddress)).toBe(false);
    expect(() => validateStellarAddress(medAddress)).toThrow(/Invalid Stellar address/);

    // Allowed when explicit option is passed
    expect(isValidStellarAddress(medAddress, { allowMuxed: true })).toBe(true);
    expect(validateStellarAddress(medAddress, { allowMuxed: true })).toBe(medAddress);
  });

  it('handles contract (C...) addresses according to options', () => {
    // Generate a contract ID from 32 zero bytes
    const contractId = StrKey.encodeContract(Buffer.alloc(32));

    // Disallowed by default
    expect(isValidStellarAddress(contractId)).toBe(false);
    expect(() => validateStellarAddress(contractId)).toThrow(/Invalid Stellar address/);

    // Allowed when explicit option is passed
    expect(isValidStellarAddress(contractId, { allowContract: true })).toBe(true);
    expect(validateStellarAddress(contractId, { allowContract: true })).toBe(contractId);
  });

  it('validates secret seeds (S...)', () => {
    expect(isValidStellarSecret(VALID_SECRET)).toBe(true);
    expect(isValidStellarSecret(`  ${VALID_SECRET}  `)).toBe(true);

    // Corrupted secret
    const corruptedSecret = VALID_SECRET.slice(0, -1) + 'A';
    expect(isValidStellarSecret(corruptedSecret)).toBe(false);

    // Public address passed as secret
    expect(isValidStellarSecret(VALID_G_ADDRESS)).toBe(false);
    expect(isValidStellarSecret('')).toBe(false);
    expect(isValidStellarSecret(null as any)).toBe(false);
    expect(isValidStellarSecret(undefined as any)).toBe(false);
  });
});
