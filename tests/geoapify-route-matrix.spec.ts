import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  GeoapifyRouteMatrixClient,
} from '../src/routing/geoapify-route-matrix-client.js';

describe(
  'GeoapifyRouteMatrixClient',
  () => {
    it(
      'maps Geoapify Route Matrix ETA and distance for eligible drivers',
      async () => {
        const fetchMock =
          vi.fn(
            async (
              input:
                | string
                | URL
                | Request,
              init?: RequestInit,
            ) => {
              const url =
                new URL(
                  String(input),
                );

              expect(
                url.pathname,
              ).toBe(
                '/v1/routematrix',
              );

              expect(
                url.searchParams.get(
                  'apiKey',
                ),
              ).toBe('test-key');

              expect(
                init?.method,
              ).toBe('POST');

              const body =
                JSON.parse(
                  String(init?.body),
                );

              expect(body).toMatchObject({
                mode: 'drive',
                type: 'balanced',
                traffic:
                  'approximated',
                units: 'metric',
              });

              expect(
                body.sources,
              ).toEqual([
                {
                  location: [
                    14.12,
                    56.01,
                  ],
                },
                {
                  location: [
                    14.13,
                    56.02,
                  ],
                },
              ]);

              return new Response(
                JSON.stringify({
                  sources_to_targets: [
                    [
                      {
                        distance: 5000,
                        time: 600,
                      },
                    ],
                    [
                      {
                        distance: 3200,
                        time: 360,
                      },
                    ],
                  ],
                }),
                { status: 200 },
              );
            },
          );

        const client =
          new GeoapifyRouteMatrixClient(
            'test-key',
            fetchMock as typeof fetch,
          );

        const result =
          await client.calculateToTarget(
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
            ],
            {
              latitude: 56.0293,
              longitude: 14.1566,
            },
          );

        expect(result).toEqual([
          {
            sourceId:
              'driver-a',
            distanceMeters:
              5000,
            durationSeconds:
              600,
            distanceKm: 5,
            durationMinutes: 10,
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
        ]);
      },
    );

    it(
      'preserves an unreachable route as null',
      async () => {
        const fetchMock =
          vi.fn(
            async () =>
              new Response(
                JSON.stringify({
                  sources_to_targets: [
                    [null],
                  ],
                }),
                { status: 200 },
              ),
          );

        const client =
          new GeoapifyRouteMatrixClient(
            'test-key',
            fetchMock as typeof fetch,
          );

        const result =
          await client.calculateToTarget(
            [
              {
                id: 'driver-a',
                latitude: 56.01,
                longitude: 14.12,
              },
            ],
            {
              latitude: 56.0293,
              longitude: 14.1566,
            },
          );

        expect(result[0]).toEqual({
          sourceId: 'driver-a',
          distanceMeters: null,
          durationSeconds: null,
          distanceKm: null,
          durationMinutes: null,
        });
      },
    );

    it(
      'rejects invalid coordinates before calling Geoapify',
      async () => {
        const fetchMock =
          vi.fn();

        const client =
          new GeoapifyRouteMatrixClient(
            'test-key',
            fetchMock as typeof fetch,
          );

        await expect(
          client.calculateToTarget(
            [
              {
                id: 'driver-a',
                latitude: 999,
                longitude: 14,
              },
            ],
            {
              latitude: 56,
              longitude: 14,
            },
          ),
        ).rejects.toThrow(
          'INVALID_ROUTE_MATRIX_SOURCE_0',
        );

        expect(
          fetchMock,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      'rejects malformed matrix dimensions',
      async () => {
        const fetchMock =
          vi.fn(
            async () =>
              new Response(
                JSON.stringify({
                  sources_to_targets: [],
                }),
                { status: 200 },
              ),
          );

        const client =
          new GeoapifyRouteMatrixClient(
            'test-key',
            fetchMock as typeof fetch,
          );

        await expect(
          client.calculateToTarget(
            [
              {
                id: 'driver-a',
                latitude: 56,
                longitude: 14,
              },
            ],
            {
              latitude: 56.1,
              longitude: 14.1,
            },
          ),
        ).rejects.toThrow(
          'ROUTE_MATRIX_NOT_RESOLVED',
        );
      },
    );
  },
);
