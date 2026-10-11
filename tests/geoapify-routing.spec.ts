import { describe, expect, it, vi } from 'vitest';
import { GeoapifyRoutingClient } from '../src/routing/geoapify-routing-client.js';

describe('GeoapifyRoutingClient', () => {
  it('builds a drive route request and parses distance/time', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));

      expect(url.origin).toBe('https://api.geoapify.com');
      expect(url.pathname).toBe('/v1/routing');
      expect(url.searchParams.get('mode')).toBe('drive');
      expect(url.searchParams.get('format')).toBe('json');
      expect(url.searchParams.get('apiKey')).toBe('test-key');

      return new Response(JSON.stringify({
        results: [{
          distance: 4230,
          time: 438
        }]
      }), { status: 200 });
    });

    const client = new GeoapifyRoutingClient('test-key', fetchMock as typeof fetch);

    const route = await client.routeDrive(
      { latitude: 56.0294, longitude: 14.1567 },
      { latitude: 56.0584565, longitude: 14.1602623 },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(route.distanceMeters).toBe(4230);
    expect(route.durationSeconds).toBe(438);
    expect(route.distanceKm).toBe(4.23);
    expect(route.durationMinutes).toBe(7.3);
  });

  it('rejects invalid coordinates before calling Geoapify', async () => {
    const fetchMock = vi.fn();

    const client = new GeoapifyRoutingClient('test-key', fetchMock as typeof fetch);

    await expect(
      client.routeDrive(
        { latitude: 999, longitude: 14 },
        { latitude: 56, longitude: 14 },
      ),
    ).rejects.toThrow('INVALID_ROUTE_ORIGIN');

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
