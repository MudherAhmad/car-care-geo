# Tutorial

This walkthrough reproduces the public Car Care Geo geospatial flow from structured address input to a validated driving route.

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
## 8. Error handling

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

This behavior is intentional.

A booking flow should not continue with an unresolved address, invalid coordinates or an unusable route.

The geospatial layer therefore returns validated spatial facts or a clear failure. It does not guess, mutate booking state or make business-authority decisions.

## 9. Verify the walkthrough

The repository is designed so that the public reference flow can be verified without production credentials.

Run the automated test suite:

```bash
npm test
```

The current suite should report:

```text
Test Files  5 passed (5)
Tests       8 passed (8)
```

Build the TypeScript project:

```bash
npm run build
```

Check the dependency tree:

```bash
npm audit --audit-level=moderate
```

A successful verification confirms the public implementation can normalize addresses, enforce strict geocoding matches, handle pickup/return behavior, resolve driving routes and aggregate booking-level route summaries.

The automated tests mock external HTTP responses, so they do not require a real Geoapify API key. A real API key is needed only when making live Geoapify requests.

## 10. End-to-end flow

The complete public walkthrough is:

1. Normalize structured Swedish address input.
2. Resolve the address with Geoapify Geocoding.
3. Reject ambiguous or structurally mismatched results.
4. Reuse the validated pickup location when the return address is the same.
5. Resolve driving routes with Geoapify Routing.
6. Combine route legs into a booking-level spatial summary.
7. Return spatial facts to the surrounding application.

At that boundary, Geoapify has solved the spatial problem. The Car Care platform remains responsible for business rules and state changes.

This separation keeps the geospatial integration reproducible, testable and safe to study without exposing the private production platform or customer data.
