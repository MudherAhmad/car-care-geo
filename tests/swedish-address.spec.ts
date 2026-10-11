import { describe, expect, it } from 'vitest';
import { normalizeSwedishAddress, normalizeSwedishPostalCode } from '../src/address/swedish-address.js';

describe('swedish address', () => {
  it('normalizes postcode', () => {
    expect(normalizeSwedishPostalCode('29133')).toBe('291 33');
  });

  it('builds canonical address', () => {
    const result = normalizeSwedishAddress({
      street: 'Gillesgatan',
      houseNumber: '10',
      postalCode: '29133',
      city: 'Kristianstad',
    });
    expect(result.canonicalAddress).toBe('Gillesgatan 10, 291 33 Kristianstad, Sweden');
  });
});
