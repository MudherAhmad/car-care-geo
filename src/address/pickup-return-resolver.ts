import { normalizeSwedishAddress, type SwedishAddressInput } from './swedish-address.js';
import { GeoapifyGeocodingClient } from '../geocoding/geoapify-geocoding-client.js';

export async function resolvePickupAndReturn(input: {
  pickup: SwedishAddressInput;
  sameReturnAddress: boolean;
  returnAddress?: SwedishAddressInput | null;
  client: GeoapifyGeocodingClient;
}) {
  const pickupAddress = normalizeSwedishAddress(input.pickup);
  const pickupGeocoded = await input.client.geocode(pickupAddress);

  if (input.sameReturnAddress) {
    return {
      pickupAddress,
      pickupGeocoded,
      returnAddress: pickupAddress,
      returnGeocoded: pickupGeocoded,
      geocodingRequestCount: 1,
    };
  }

  if (!input.returnAddress) throw new Error('RETURN_ADDRESS_REQUIRED');

  const returnAddress = normalizeSwedishAddress(input.returnAddress);
  const returnGeocoded = await input.client.geocode(returnAddress);

  return {
    pickupAddress,
    pickupGeocoded,
    returnAddress,
    returnGeocoded,
    geocodingRequestCount: 2,
  };
}
