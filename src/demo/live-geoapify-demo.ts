import {
  resolvePickupAndReturn,
} from '../address/pickup-return-resolver.js';
import {
  GeoapifyGeocodingClient,
} from '../geocoding/geoapify-geocoding-client.js';
import {
  GeoapifyRoutingClient,
} from '../routing/geoapify-routing-client.js';
import {
  resolveBookingRoutes,
} from '../routing/booking-route-resolver.js';
import {
  GeoapifyRouteMatrixClient,
} from '../routing/geoapify-route-matrix-client.js';
import {
  recommendDriverWithGeoapify,
} from './smart-driver-recommendation.js';

function requireApiKey(): string {
  const key = process.env.GEOAPIFY_API_KEY?.trim() ?? '';

  if (!key) {
    throw new Error('GEOAPIFY_API_KEY_REQUIRED');
  }

  return key;
}

async function main(): Promise<void> {
  const apiKey = requireApiKey();

  const geocoder = new GeoapifyGeocodingClient(apiKey);
  const router = new GeoapifyRoutingClient(apiKey);
  const matrix = new GeoapifyRouteMatrixClient(apiKey);

  const pickup = {
    street: process.env.DEMO_STREET ?? 'Lasarettsboulevarden',
    houseNumber: process.env.DEMO_HOUSE_NUMBER ?? '10',
    postalCode: process.env.DEMO_POSTAL_CODE ?? '29133',
    city: process.env.DEMO_CITY ?? 'Kristianstad',
    country: 'Sweden',
  };

  console.log('1/4 Resolving structured Swedish address...');

  const resolved = await resolvePickupAndReturn({
    pickup,
    sameReturnAddress: true,
    client: geocoder,
  });

  console.log(
    `Resolved: ${resolved.pickupGeocoded.formattedAddress}`,
  );

  console.log('2/4 Calculating pickup and return routes...');

  const company = {
    latitude: 56.0294,
    longitude: 14.1567,
  };

  const routeSummary = await resolveBookingRoutes({
    company,
    pickup: resolved.pickupGeocoded,
    returnAddress: resolved.returnGeocoded,
    sameReturnAddress: true,
    client: router,
  });

  console.log(
    '3/4 Comparing synthetic eligible drivers with Route Matrix...',
  );

  const drivers = [
    {
      id: 'driver-a',
      latitude: 56.0315,
      longitude: 14.1575,
    },
    {
      id: 'driver-b',
      latitude: 56.0245,
      longitude: 14.1450,
    },
    {
      id: 'driver-c',
      latitude: 56.0390,
      longitude: 14.1700,
    },
  ];

  const recommendation = await recommendDriverWithGeoapify({
    drivers,
    pickup: {
      latitude: resolved.pickupGeocoded.latitude,
      longitude: resolved.pickupGeocoded.longitude,
    },
    client: matrix,
  });

  if (recommendation.degraded) {
    throw new Error(
      `SMART_DISPATCH_DEGRADED:${recommendation.degradedReason}`,
    );
  }

  console.log('4/4 Spatial recommendation complete.');

  console.log(
    JSON.stringify(
      {
        status: 'ok',
        provider: 'geoapify',
        address: {
          requested: resolved.pickupAddress.canonicalAddress,
          resolved: resolved.pickupGeocoded.formattedAddress,
          latitude: resolved.pickupGeocoded.latitude,
          longitude: resolved.pickupGeocoded.longitude,
        },
        pickupReturn: {
          sameReturnAddress: true,
          geocodingRequestCount: resolved.geocodingRequestCount,
        },
        route: {
          pickupToCompany: routeSummary.pickupToCompany,
          companyToReturn: routeSummary.companyToReturn,
          totalDistanceKm: routeSummary.totalDistanceKm,
          totalDurationMinutes: routeSummary.totalDurationMinutes,
          routingRequestCount: routeSummary.routingRequestCount,
        },
        smartDispatch: {
          eligibleDriverCount: drivers.length,
          recommendedDriverId: recommendation.recommendedDriverId,
          candidates: recommendation.candidates.map((candidate) => ({
            driverId: candidate.driverId,
            etaMinutes: candidate.durationMinutes,
            distanceKm: candidate.distanceKm,
          })),
        },
        authorityBoundary: {
          spatialAuthority: 'Geoapify',
          businessAuthority: 'Car Care',
          driverAssignmentPerformed: false,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : String(error);

  console.error(`LIVE_DEMO_FAILED: ${message}`);
  process.exitCode = 1;
});
