import { describe, expect, it, vi } from 'vitest';
import { GeoapifyGeocodingClient } from '../src/geocoding/geoapify-geocoding-client.js';
import { resolvePickupAndReturn } from '../src/address/pickup-return-resolver.js';

describe('pickup return resolver', () => {
  it('reuses geocoding for same address', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      results: [{
        lat: 56.0293,
        lon: 14.1567,
        formatted: 'Gillesgatan 10, 291 33 Kristianstad, Sweden',
        street: 'Gillesgatan',
        housenumber: '10',
        postcode: '291 33',
        city: 'Kristianstad'
      }]
    }), { status: 200 }));

    const client = new GeoapifyGeocodingClient('test-key', fetchMock as typeof fetch);

    const result = await resolvePickupAndReturn({
      pickup: {
        street: 'Gillesgatan',
        houseNumber: '10',
        postalCode: '29133',
        city: 'Kristianstad',
      },
      sameReturnAddress: true,
      client,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.geocodingRequestCount).toBe(1);
  });
});