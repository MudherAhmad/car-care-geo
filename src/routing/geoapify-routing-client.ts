export type RoutePoint = {
  latitude: number;
  longitude: number;
};

export type DrivingRoute = {
  distanceMeters: number;
  durationSeconds: number;
  distanceKm: number;
  durationMinutes: number;
};

type GeoapifyRoutingResult = {
  distance?: number;
  time?: number;
};

function isValidCoordinate(point: RoutePoint): boolean {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    point.longitude >= -180 &&
    point.longitude <= 180
  );
}

export class GeoapifyRoutingClient {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (!apiKey.trim()) throw new Error('GEOAPIFY_API_KEY_REQUIRED');
  }

  async routeDrive(
    from: RoutePoint,
    to: RoutePoint,
  ): Promise<DrivingRoute> {
    if (!isValidCoordinate(from)) throw new Error('INVALID_ROUTE_ORIGIN');
    if (!isValidCoordinate(to)) throw new Error('INVALID_ROUTE_DESTINATION');

    const waypoints =
      `${from.latitude},${from.longitude}|${to.latitude},${to.longitude}`;

    const params = new URLSearchParams({
      waypoints,
      mode: 'drive',
      format: 'json',
      apiKey: this.apiKey,
    });

    const url = 'https://api.geoapify.com/v1/routing?' + params.toString();

    const response = await this.fetchImpl(url, {
      headers: { accept: 'application/json' },
    });

    if (!response.ok) throw new Error('GEOAPIFY_ROUTING_HTTP_' + response.status);

    const payload = await response.json() as {
      results?: GeoapifyRoutingResult[];
    };

    const route = Array.isArray(payload.results)
      ? payload.results[0]
      : undefined;

    if (
      !route ||
      typeof route.distance !== 'number' ||
      typeof route.time !== 'number' ||
      !Number.isFinite(route.distance) ||
      !Number.isFinite(route.time) ||
      route.distance < 0 ||
      route.time < 0
    ) {
      throw new Error('ROUTE_NOT_RESOLVED');
    }

    return {
      distanceMeters: route.distance,
      durationSeconds: route.time,
      distanceKm: Math.round((route.distance / 1000) * 100) / 100,
      durationMinutes: Math.round((route.time / 60) * 10) / 10,
    };
  }
}
