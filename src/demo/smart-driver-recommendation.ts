import {
  GeoapifyRouteMatrixClient,
  type RouteMatrixPoint,
  type RouteMatrixResult,
} from '../routing/geoapify-route-matrix-client.js';

export type EligibleDriverCandidate = {
  id: string;
  latitude: number;
  longitude: number;
};

export type RankedDriverCandidate = {
  driverId: string;
  distanceMeters: number;
  durationSeconds: number;
  distanceKm: number;
  durationMinutes: number;
  reason: string;
};

export type SmartDriverRecommendation = {
  provider: 'geoapify';
  degraded: boolean;
  degradedReason: string | null;
  recommendedDriverId: string | null;
  candidates: RankedDriverCandidate[];
};

export function rankDriversByEta(
  drivers: EligibleDriverCandidate[],
  matrixResults: RouteMatrixResult[],
): SmartDriverRecommendation {
  const matrixByDriver =
    new Map(
      matrixResults.map(
        (result) => [
          result.sourceId,
          result,
        ],
      ),
    );

  const ranked:
    RankedDriverCandidate[] = [];

  for (const driver of drivers) {
    const route =
      matrixByDriver.get(driver.id);

    if (
      route?.distanceMeters == null ||
      route.durationSeconds == null ||
      route.distanceKm == null ||
      route.durationMinutes == null
    ) {
      continue;
    }

    ranked.push({
      driverId: driver.id,
      distanceMeters:
        route.distanceMeters,
      durationSeconds:
        route.durationSeconds,
      distanceKm:
        route.distanceKm,
      durationMinutes:
        route.durationMinutes,
      reason:
        'Lowest driving ETA to pickup among eligible drivers',
    });
  }

  ranked.sort((a, b) => {
    const eta =
      a.durationSeconds -
      b.durationSeconds;

    if (eta !== 0) {
      return eta;
    }

    const distance =
      a.distanceMeters -
      b.distanceMeters;

    if (distance !== 0) {
      return distance;
    }

    return a.driverId.localeCompare(
      b.driverId,
    );
  });

  if (ranked.length === 0) {
    return {
      provider: 'geoapify',
      degraded: true,
      degradedReason:
        'NO_MATRIX_ROUTES',
      recommendedDriverId: null,
      candidates: [],
    };
  }

  return {
    provider: 'geoapify',
    degraded: false,
    degradedReason: null,
    recommendedDriverId:
      ranked[0].driverId,
    candidates: ranked,
  };
}

export async function recommendDriverWithGeoapify(
  input: {
    drivers: EligibleDriverCandidate[];
    pickup: RouteMatrixPoint;
    client: GeoapifyRouteMatrixClient;
  },
): Promise<SmartDriverRecommendation> {
  /*
   * Eligibility remains application-owned.
   *
   * The caller provides drivers that have already passed
   * availability, conflict and location-freshness checks.
   *
   * Geoapify supplies spatial evidence only:
   * road ETA and distance to pickup.
   *
   * Final assignment remains outside this function.
   */
  if (input.drivers.length === 0) {
    return {
      provider: 'geoapify',
      degraded: true,
      degradedReason:
        'NO_ROUTE_ELIGIBLE_DRIVERS',
      recommendedDriverId: null,
      candidates: [],
    };
  }

  try {
    const matrixResults =
      await input.client.calculateToTarget(
        input.drivers.map(
          (driver) => ({
            id: driver.id,
            latitude:
              driver.latitude,
            longitude:
              driver.longitude,
          }),
        ),
        input.pickup,
      );

    return rankDriversByEta(
      input.drivers,
      matrixResults,
    );
  } catch {
    return {
      provider: 'geoapify',
      degraded: true,
      degradedReason:
        'ROUTE_MATRIX_UNAVAILABLE',
      recommendedDriverId: null,
      candidates: [],
    };
  }
}
