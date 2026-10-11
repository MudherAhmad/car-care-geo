import { describe, expect, it, vi } from 'vitest';
import { normalizeSwedishAddress } from '../src/address/swedish-address.js';
import { GeoapifyGeocodingClient } from '../src/geocoding/geoapify-geocoding-client.js';

describe('strict Geoapify address matching', () => {
  it('ignores misleading city, postcode and wrong-street results', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      results: [
        {
          lat: 56.037581,
          lon: 14.165434,
          formatted: 'Kristianstad, Sverige',
          postcode: '29133',
          city: 'Kristianstad',
          result_type: 'city'
        },
        {
          lat: 56.031828,
          lon: 14.1657,
          formatted: 'Lasarettsboulevarden 10, Kristianstad',
          street: 'Lasarettsboulevarden',
          housenumber: '10',
          postcode: '29133',
          city: 'Kristianstad',
          result_type: 'building'
        },
        {
          lat: 56.123456,
          lon: 14.123456,
          formatted: 'Gillesgatan 10, 291 33 Kristianstad, Sverige',
          street: 'Gillesgatan',
          housenumber: '10',
          postcode: '291 33',
          city: 'Kristianstad',
          result_type: 'building',
          place_id: 'correct-place'
        }
      ]
    }), { status: 200 }));

    const client = new GeoapifyGeocodingClient('test-key', fetchMock as typeof fetch);

    const address = normalizeSwedishAddress({
      street: 'Gillesgatan',
      houseNumber: '10',
      postalCode: '29133',
      city: 'Kristianstad'
    });

    const result = await client.geocode(address);

    expect(result.placeId).toBe('correct-place');
    expect(result.latitude).toBe(56.123456);
    expect(result.longitude).toBe(14.123456);
  });

  it('rejects results when no exact street and house match exists', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      results: [
        {
          lat: 56.037581,
          lon: 14.165434,
          postcode: '29133',
          city: 'Kristianstad',
          result_type: 'city'
        },
        {
          lat: 56.031828,
          lon: 14.1657,
          street: 'Lasarettsboulevarden',
          housenumber: '10',
          postcode: '29133',
          city: 'Kristianstad'
        }
      ]
    }), { status: 200 }));

    const client = new GeoapifyGeocodingClient('test-key', fetchMock as typeof fetch);

    const address = normalizeSwedishAddress({
      street: 'Gillesgatan',
      houseNumber: '10',
      postalCode: '29133',
      city: 'Kristianstad'
    });

    await expect(client.geocode(address)).rejects.toThrow('ADDRESS_NOT_RESOLVED');
  });
});
