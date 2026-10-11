import type { GeocodedAddress } from '../geocoding/geoapify-geocoding-client.js';
import { GeoapifyRoutingClient } from './geoapify-routing-client.js';

export type BookingRouteSummary = {
  pickupToCompany: {
    distanceKm: number;
    durationMinutes: number;
  };
  companyToReturn: {
    distanceKm: number;
    durationMinutes: number;
  };
  totalDistanceKm: number;
  totalDurationMinutes: number;
  routingRequestCount: number;
};

export async function resolveBookingRoutes(input: {
  company: { latitude: number; longitude: number };
  pickup: GeocodedAddress;
  returnAddress: GeocodedAddress;
  sameReturnAddress: boolean;
  client: GeoapifyRoutingClient;
}): Promise<BookingRouteSummary> {
  const pickupToCompany = await input.client.routeDrive(
    {
      latitude: input.pickup.latitude,
      longitude: input.pickup.longitude,
    },
    input.company,
  );

  let companyToReturn;

  if (input.sameReturnAddress) {
    companyToReturn = await input.client.routeDrive(
      input.company,
      {
        latitude: input.pickup.latitude,
        longitude: input.pickup.longitude,
      },
    );
  } else {
    companyToReturn = await input.client.routeDrive(
      input.company,
      {
        latitude: input.returnAddress.latitude,
        longitude: input.returnAddress.longitude,
      },
    );
  }

  const totalDistanceKm =
    Math.round(
      (pickupToCompany.distanceKm + companyToReturn.distanceKm) * 100,
    ) / 100;

  const totalDurationMinutes =
    Math.round(
      (pickupToCompany.durationMinutes +
        companyToReturn.durationMinutes) *
        10,
    ) / 10;

  return {
    pickupToCompany: {
      distanceKm: pickupToCompany.distanceKm,
      durationMinutes: pickupToCompany.durationMinutes,
    },
    companyToReturn: {
      distanceKm: companyToReturn.distanceKm,
      durationMinutes: companyToReturn.durationMinutes,
    },
    totalDistanceKm,
    totalDurationMinutes,
    routingRequestCount: 2,
  };
}
