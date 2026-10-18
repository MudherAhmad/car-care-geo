import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  rankDriversByEta,
  recommendDriverWithGeoapify,
} from '../src/demo/smart-driver-recommendation.js';

describe(
  'Smart Driver Recommendation',
  () => {
    it(
      'ranks eligible drivers by ETA and uses distance as the tie-breaker',
      () => {
        const result =
          rankDriversByEta(
            [
              {
                id: 'driver-a',
                latitude: 56.01,
                longitude: 14.12,
              },
              {
                id: 'driver-b',
                latitude: 56.02,
                longitude: 14.13,
              },
              {
                id: 'driver-c',
                latitude: 56.03,
                longitude: 14.14,
              },
            ],
            [
              {
                sourceId:
                  'driver-a',
                distanceMeters:
                  2000,
                durationSeconds:
                  420,
                distanceKm: 2,
                durationMinutes: 7,
              },
              {
                sourceId:
                  'driver-b',
                distanceMeters:
                  3200,
                durationSeconds:
                  360,
                distanceKm: 3.2,
                durationMinutes: 6,
              },
              {
                sourceId:
                  'driver-c',
                distanceMeters:
                  2500,
                durationSeconds:
                  360,
                distanceKm: 2.5,
                durationMinutes: 6,
              },
            ],
          );

        expect(
          result.degraded,
        ).toBe(false);

        expect(
          result.recommendedDriverId,
        ).toBe('driver-c');

        expect(
          result.candidates.map(
            (candidate) =>
              candidate.driverId,
          ),
        ).toEqual([
          'driver-c',
          'driver-b',
          'driver-a',
        ]);
      },
    );

    it(
      'returns no recommendation when no usable matrix route exists',
      () => {
        const result =
          rankDriversByEta(
            [
              {
                id: 'driver-a',
                latitude: 56.01,
                longitude: 14.12,
              },
            ],
            [
              {
                sourceId:
                  'driver-a',
                distanceMeters:
                  null,
                durationSeconds:
                  null,
                distanceKm: null,
                durationMinutes:
                  null,
              },
            ],
          );

        expect(
          result.degraded,
        ).toBe(true);

        expect(
          result.degradedReason,
        ).toBe(
          'NO_MATRIX_ROUTES',
        );

        expect(
          result.recommendedDriverId,
        ).toBeNull();
      },
    );

    it(
      'uses one Geoapify Route Matrix call and does not perform assignment',
      async () => {
        const client = {
          calculateToTarget:
            vi.fn()
              .mockResolvedValue([
                {
                  sourceId:
                    'driver-a',
                  distanceMeters:
                    4200,
                  durationSeconds:
                    480,
                  distanceKm: 4.2,
                  durationMinutes: 8,
                },
                {
                  sourceId:
                    'driver-b',
                  distanceMeters:
                    3100,
                  durationSeconds:
                    330,
                  distanceKm: 3.1,
                  durationMinutes: 5.5,
                },
              ]),
        };

        const result =
          await recommendDriverWithGeoapify(
            {
              drivers: [
                {
                  id: 'driver-a',
                  latitude: 56.01,
                  longitude: 14.12,
                },
                {
                  id: 'driver-b',
                  latitude: 56.02,
                  longitude: 14.13,
                },
              ],
              pickup: {
                latitude:
                  56.0293,
                longitude:
                  14.1566,
              },
              client:
                client as any,
            },
          );

        expect(
          client.calculateToTarget,
        ).toHaveBeenCalledTimes(1);

        expect(
          result.recommendedDriverId,
        ).toBe('driver-b');

        expect(
          result.provider,
        ).toBe('geoapify');

        expect(
          result.degraded,
        ).toBe(false);
      },
    );

    it(
      'degrades safely when Route Matrix is unavailable',
      async () => {
        const client = {
          calculateToTarget:
            vi.fn()
              .mockRejectedValue(
                new Error(
                  'provider_failed',
                ),
              ),
        };

        const result =
          await recommendDriverWithGeoapify(
            {
              drivers: [
                {
                  id: 'driver-a',
                  latitude: 56.01,
                  longitude: 14.12,
                },
              ],
              pickup: {
                latitude:
                  56.0293,
                longitude:
                  14.1566,
              },
              client:
                client as any,
            },
          );

        expect(
          result.degraded,
        ).toBe(true);

        expect(
          result.degradedReason,
        ).toBe(
          'ROUTE_MATRIX_UNAVAILABLE',
        );

        expect(
          result.recommendedDriverId,
        ).toBeNull();
      },
    );
  },
);
