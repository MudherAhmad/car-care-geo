import { describe, expect, it, vi } from 'vitest';
import { GeoapifyRoutingClient } from '../src/routing/geoapify-routing-client.js';
import { resolveBookingRoutes } from '../src/routing/booking-route-resolver.js';

describe('booking route resolver', () => {
  it('creates pickup-to-company and company-to-return routes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          results: [{ distance: 4230, time: 438 }]
        }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          results: [{ distance: 4200, time: 420 }]
        }), { status: 200 })
      );

    const client = new GeoapifyRoutingClient('test-key', fetchMock as typeof fetch);

    const result = await resolveBookingRoutes({
      company: { latitude: 56.0294, longitude: 14.1567 },
      pickup: {
        latitude: 56.0584565,
        longitude: 14.1602623,
        formattedAddress: 'Ingelstadsgatan 34',
        placeId: null,
      },
      returnAddress: {
        latitude: 56.0584565,
        longitude: 14.1602623,
        formattedAddress: 'Ingelstadsgatan 34',
        placeId: null,
      },
      sameReturnAddress: true,
      client,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.routingRequestCount).toBe(2);
    expect(result.pickupToCompany.distanceKm).toBe(4.23);
    expect(result.companyToReturn.distanceKm).toBe(4.2);
    expect(result.totalDistanceKm).toBe(8.43);
    expect(result.totalDurationMinutes).toBe(14.3);
  });
});
