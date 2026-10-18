export type RouteMatrixPoint = {
  latitude: number;
  longitude: number;
};

export type RouteMatrixSource =
  RouteMatrixPoint & {
    id: string;
  };

export type RouteMatrixResult = {
  sourceId: string;
  distanceMeters: number | null;
  durationSeconds: number | null;
  distanceKm: number | null;
  durationMinutes: number | null;
};

type GeoapifyRouteMatrixCell = {
  distance?: unknown;
  time?: unknown;
} | null;

function isValidPoint(
  point: RouteMatrixPoint,
): boolean {
  return (
    point != null &&
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    point.longitude >= -180 &&
    point.longitude <= 180
  );
}

function parseFiniteNonNegative(
  value: unknown,
): number | null {
  const parsed =
    typeof value === 'number'
      ? value
      : Number.parseFloat(
          String(value ?? ''),
        );

  return Number.isFinite(parsed) &&
    parsed >= 0
    ? parsed
    : null;
}

function roundKm(
  distanceMeters: number,
): number {
  return (
    Math.round(
      (distanceMeters / 1000) * 100,
    ) / 100
  );
}

function roundMinutes(
  durationSeconds: number,
): number {
  return (
    Math.round(
      (durationSeconds / 60) * 10,
    ) / 10
  );
}

export class GeoapifyRouteMatrixClient {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl:
      typeof fetch = fetch,
  ) {
    if (!apiKey.trim()) {
      throw new Error(
        'GEOAPIFY_API_KEY_REQUIRED',
      );
    }
  }

  async calculateToTarget(
    sources: RouteMatrixSource[],
    target: RouteMatrixPoint,
  ): Promise<RouteMatrixResult[]> {
    if (!Array.isArray(sources)) {
      throw new Error(
        'INVALID_ROUTE_MATRIX_SOURCES',
      );
    }

    if (sources.length === 0) {
      return [];
    }

    if (sources.length > 1000) {
      throw new Error(
        'ROUTE_MATRIX_TOO_MANY_SOURCES',
      );
    }

    const ids = new Set<string>();

    for (
      let index = 0;
      index < sources.length;
      index += 1
    ) {
      const source = sources[index];
      const id =
        String(source?.id ?? '').trim();

      if (!id) {
        throw new Error(
          `INVALID_ROUTE_MATRIX_SOURCE_${index}_ID`,
        );
      }

      if (ids.has(id)) {
        throw new Error(
          'DUPLICATE_ROUTE_MATRIX_SOURCE_ID',
        );
      }

      ids.add(id);

      if (!isValidPoint(source)) {
        throw new Error(
          `INVALID_ROUTE_MATRIX_SOURCE_${index}`,
        );
      }
    }

    if (!isValidPoint(target)) {
      throw new Error(
        'INVALID_ROUTE_MATRIX_TARGET',
      );
    }

    const params =
      new URLSearchParams({
        apiKey: this.apiKey,
      });

    const url =
      'https://api.geoapify.com/v1/routematrix?' +
      params.toString();

    const response =
      await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type':
            'application/json',
        },
        body: JSON.stringify({
          mode: 'drive',
          type: 'balanced',
          traffic: 'approximated',
          units: 'metric',
          sources: sources.map(
            (source) => ({
              location: [
                source.longitude,
                source.latitude,
              ],
            }),
          ),
          targets: [
            {
              location: [
                target.longitude,
                target.latitude,
              ],
            },
          ],
        }),
      });

    if (!response.ok) {
      throw new Error(
        'GEOAPIFY_ROUTE_MATRIX_HTTP_' +
          response.status,
      );
    }

    const payload =
      await response.json() as {
        sources_to_targets?: unknown;
      };

    const matrix =
      payload.sources_to_targets;

    if (
      !Array.isArray(matrix) ||
      matrix.length !== sources.length
    ) {
      throw new Error(
        'ROUTE_MATRIX_NOT_RESOLVED',
      );
    }

    return sources.map(
      (source, sourceIndex) => {
        const row =
          matrix[sourceIndex];

        if (
          !Array.isArray(row) ||
          row.length !== 1
        ) {
          throw new Error(
            'ROUTE_MATRIX_NOT_RESOLVED',
          );
        }

        const rawCell =
          row[0] as
            | GeoapifyRouteMatrixCell
            | undefined;

        if (
          rawCell !== null &&
          rawCell !== undefined &&
          (
            typeof rawCell !== 'object' ||
            Array.isArray(rawCell)
          )
        ) {
          throw new Error(
            'ROUTE_MATRIX_NOT_RESOLVED',
          );
        }

        const distanceMeters =
          parseFiniteNonNegative(
            rawCell?.distance,
          );

        const durationSeconds =
          parseFiniteNonNegative(
            rawCell?.time,
          );

        return {
          sourceId: source.id,
          distanceMeters,
          durationSeconds,
          distanceKm:
            distanceMeters == null
              ? null
              : roundKm(
                  distanceMeters,
                ),
          durationMinutes:
            durationSeconds == null
              ? null
              : roundMinutes(
                  durationSeconds,
                ),
        };
      },
    );
  }
}
