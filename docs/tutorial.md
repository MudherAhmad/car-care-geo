# Tutorial

The geospatial APIs used in this walkthrough are provided by [Geoapify](https://www.geoapify.com/).

This walkthrough reproduces the public Car Care Geo geospatial flow from structured address input to validated driving routes and a reproducible Route Matrix driver recommendation.

> **Geoapify solves the spatial problem. The Car Care platform remains the business authority.**

The tutorial uses only the sanitized public repository. It does not require access to the private Car Care Sverige production codebase or production customer data.

## 1. Prerequisites

You need:

- Node.js `^22.12.0`, `^24.0.0`, or `>=26.0.0`
- npm
- Git
- a Geoapify API key for live Geoapify requests

Clone the repository:

```bash
git clone https://github.com/MudherAhmad/car-care-geo.git
cd car-care-geo
```

Install the locked dependency graph:

```bash
npm ci
```
## 2. Configure the Geoapify API key

Create a local environment file:

```bash
cp .env.example .env
```

Set your own key:

```text
GEOAPIFY_API_KEY=your_own_geoapify_key
```

Never commit `.env` or a real API key.

Before making live requests, load the local file into your current shell:

```bash
set -a
. ./.env
set +a
```

## 3. Structured Swedish address input

The public address model keeps street, house number, postal code and city as separate fields before building a canonical address.

Example:

```ts
import { normalizeSwedishAddress } from '../src/address/swedish-address.js';

const address = normalizeSwedishAddress({
  street: 'Gillesgatan',
  houseNumber: '10',
  postalCode: '29133',
  city: 'Kristianstad',
});

console.log(address.canonicalAddress);
```

Expected canonical form:

```text
Gillesgatan 10, 291 33 Kristianstad, Sweden
```

The normalization step also rejects missing street, house number or city values and rejects an invalid Swedish five-digit postal code.
## 4. Geocode with Geoapify

`GeoapifyGeocodingClient` receives a normalized Swedish address and sends structured fields to the Geoapify Geocoding API.

The request includes:

- `street`
- `housenumber`
- `postcode`
- `city`
- `country`
- `filter=countrycode:se`
- `lang=sv`
- `limit=10`
- `format=json`

Create the client with your API key:

```ts
import { GeoapifyGeocodingClient } from '../src/geocoding/geoapify-geocoding-client.js';

const geocoder = new GeoapifyGeocodingClient(
  process.env.GEOAPIFY_API_KEY ?? '',
);

const result = await geocoder.geocode(address);

console.log(result.latitude, result.longitude);
console.log(result.formattedAddress);
```

The client does not simply accept the first result returned by the API.

A candidate is accepted only when its coordinates are finite and valid and its street, house number, postal code and city match the normalized input.

If no exact acceptable candidate exists, the client throws `ADDRESS_NOT_RESOLVED`.

Geoapify HTTP failures are surfaced as `GEOAPIFY_HTTP_<status>`.
## 5. Handle pickup and return addresses

`resolvePickupAndReturn` normalizes and geocodes the pickup address first.

When `sameReturnAddress` is `true`, the already validated pickup address and geocoded result are reused for the return location.

```ts
const resolved = await resolvePickupAndReturn({
  pickup,
  sameReturnAddress: true,
  client: geocoder,
});

console.log(resolved.geocodingRequestCount);
```

Expected result:

```text
1
```

This avoids making a second Geoapify geocoding request for the same location.

When `sameReturnAddress` is `false`, a separate return address is required:

```ts
const resolved = await resolvePickupAndReturn({
  pickup,
  sameReturnAddress: false,
  returnAddress,
  client: geocoder,
});
```

In that case the return address is normalized and geocoded independently and `geocodingRequestCount` is `2`.

If a separate return address is required but missing, the resolver throws `RETURN_ADDRESS_REQUIRED`.
## 6. Resolve driving routes with Geoapify

After geocoding, `GeoapifyRoutingClient` accepts validated coordinate pairs and requests a driving route from the Geoapify Routing API.

The request uses:

- `mode=drive`
- `format=json`
- two validated waypoints
- your Geoapify API key

Example:

```ts
import { GeoapifyRoutingClient } from '../src/routing/geoapify-routing-client.js';

const router = new GeoapifyRoutingClient(
  process.env.GEOAPIFY_API_KEY ?? '',
);

const route = await router.routeDrive(
  {
    latitude: resolved.pickupGeocoded.latitude,
    longitude: resolved.pickupGeocoded.longitude,
  },
  company,
);

console.log(route.distanceKm);
console.log(route.durationMinutes);
```

Before the API request, both origin and destination coordinates are checked for finite values and valid latitude/longitude ranges.

Invalid origins throw `INVALID_ROUTE_ORIGIN`.

Invalid destinations throw `INVALID_ROUTE_DESTINATION`.

Geoapify routing HTTP failures are surfaced as `GEOAPIFY_ROUTING_HTTP_<status>`.

If the response does not contain a valid non-negative distance and duration, the client throws `ROUTE_NOT_RESOLVED`.

The returned summary includes distance in meters and kilometers plus duration in seconds and minutes.
## 7. Build the booking route summary

`resolveBookingRoutes` combines the geocoded customer locations with the company location.

It creates two driving legs:

1. pickup to company
2. company to return address

When `sameReturnAddress` is `true`, the second leg routes from the company back to the pickup coordinates.

```ts
const summary = await resolveBookingRoutes({
  company,
  pickup: resolved.pickupGeocoded,
  returnAddress: resolved.returnGeocoded,
  sameReturnAddress: true,
  client: router,
});

console.log(summary);
```

The returned summary contains:

- `pickupToCompany.distanceKm`
- `pickupToCompany.durationMinutes`
- `companyToReturn.distanceKm`
- `companyToReturn.durationMinutes`
- `totalDistanceKm`
- `totalDurationMinutes`
- `routingRequestCount`

The resolver performs two routing requests and combines both route legs into one booking-level spatial summary.

For example, the automated test verifies route legs of `4.23 km` and `4.2 km`, producing `8.43 km` total and `14.3` total minutes.

This summary is spatial information only. Booking, pricing, membership, capacity and driver-assignment decisions remain outside the Geoapify layer.
## 8. Compare eligible drivers with Geoapify Route Matrix

Smart Dispatch asks a second spatial question:

> Among drivers already declared eligible by the application, which driver has the lowest driving cost to the pickup location?

Eligibility remains application-owned. Availability, booking conflicts, permissions and location-freshness rules are resolved before Geoapify is called.

`GeoapifyRouteMatrixClient` sends the eligible driver coordinates as sources and the pickup coordinate as the target.

The request uses:

- `mode=drive`
- `type=balanced`
- `traffic=approximated`
- `units=metric`

Each usable matrix result provides road distance and driving ETA.

The public Smart Dispatch reference ranks candidates by:

1. lowest driving ETA
2. lowest driving distance when ETA is equal
3. stable driver identifier as the final deterministic tie-breaker

Unreachable cells remain unavailable spatial evidence. If no usable route exists, no driver is recommended.

If Route Matrix is unavailable, the recommendation degrades safely instead of guessing.

Geoapify provides the spatial evidence only. Final driver assignment remains a Car Care application decision.

## 9. Error handling

The public reference implementation fails explicitly instead of silently accepting uncertain spatial data.

The main validation and Geoapify errors are:

- `STREET_REQUIRED`
- `HOUSE_NUMBER_REQUIRED`
- `CITY_REQUIRED`
- `INVALID_SWEDISH_POSTAL_CODE`
- `GEOAPIFY_API_KEY_REQUIRED`
- `GEOAPIFY_HTTP_<status>`
- `ADDRESS_NOT_RESOLVED`
- `RETURN_ADDRESS_REQUIRED`
- `INVALID_ROUTE_ORIGIN`
- `INVALID_ROUTE_DESTINATION`
- `GEOAPIFY_ROUTING_HTTP_<status>`
- `ROUTE_NOT_RESOLVED`
- `INVALID_ROUTE_MATRIX_SOURCES`
- `INVALID_ROUTE_MATRIX_SOURCE_<index>`
- `INVALID_ROUTE_MATRIX_TARGET`
- `DUPLICATE_ROUTE_MATRIX_SOURCE_ID`
- `ROUTE_MATRIX_TOO_MANY_SOURCES`
- `GEOAPIFY_ROUTE_MATRIX_HTTP_<status>`
- `ROUTE_MATRIX_NOT_RESOLVED`

This behavior is intentional.

A booking flow should not continue with an unresolved address, invalid coordinates or an unusable route.

The geospatial layer therefore returns validated spatial facts or a clear failure. It does not guess, mutate booking state or make business-authority decisions.

## 10. Verify the walkthrough

The repository is designed so that the public reference flow can be verified without production credentials.

Run the automated test suite:

```bash
npm test
```

The current suite should report:

```text
Test Files  7 passed (7)
Tests       16 passed (16)
```

Build the TypeScript project:

```bash
npm run build
```

Check the dependency tree:

```bash
npm audit --audit-level=moderate
```

A successful verification confirms the public implementation can normalize addresses, enforce strict geocoding matches, handle pickup/return behavior, resolve driving routes, aggregate booking-level route summaries, validate Geoapify Route Matrix responses and rank already-eligible driver candidates deterministically by road ETA and distance.

The automated tests mock external HTTP responses, so they do not require a real Geoapify API key. A real API key is needed only when making live Geoapify requests.

## 11. End-to-end flow

The complete public walkthrough is:

1. Normalize structured Swedish address input.
2. Resolve the address with Geoapify Geocoding.
3. Reject ambiguous or structurally mismatched results.
4. Reuse the validated pickup location when the return address is the same.
5. Resolve driving routes with Geoapify Routing.
6. Combine route legs into a booking-level spatial summary.
7. Send already-eligible driver candidates and the pickup target to Geoapify Route Matrix.
8. Rank usable candidates by driving ETA, then distance.
9. Return a spatial recommendation without performing driver assignment.
10. Return spatial facts to the surrounding application.

At that boundary, Geoapify has solved the spatial problem. The Car Care platform remains responsible for business rules and state changes.

This separation keeps the geospatial integration reproducible, testable and safe to study without exposing the private production platform or customer data.

## 12. Live Geoapify competition demo

The automated tests use deterministic mocked responses. A live walkthrough is also available.

Load the API key from `.env`, then run:

```bash
set -a
. ./.env
set +a
npm run demo:live
```

The command performs live geocoding, routing and Route Matrix comparison, then ranks synthetic already-eligible driver candidates.

The final result is a spatial recommendation only. It does not assign a driver or mutate production state.

> Geoapify solves the spatial problem. The Car Care platform remains the business authority.
