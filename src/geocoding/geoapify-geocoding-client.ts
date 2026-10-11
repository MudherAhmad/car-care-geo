import type { NormalizedSwedishAddress } from '../address/swedish-address.js';

export type GeocodedAddress = {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  placeId: string | null;
};

type GeoapifyResult = {
  lat?: number;
  lon?: number;
  formatted?: string;
  place_id?: string;
  street?: string;
  housenumber?: string;
  postcode?: string;
  city?: string;
  result_type?: string;
  rank?: {
    confidence?: number;
    confidence_street_level?: number;
    confidence_building_level?: number;
    match_type?: string;
  };
};

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('sv-SE')
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePostcode(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

function isExactAddressMatch(
  result: GeoapifyResult,
  address: NormalizedSwedishAddress,
): boolean {
  return (
    normalizeText(result.street) === normalizeText(address.street) &&
    normalizeText(result.housenumber) === normalizeText(address.houseNumber) &&
    normalizePostcode(result.postcode) === normalizePostcode(address.postalCode) &&
    normalizeText(result.city) === normalizeText(address.city)
  );
}

export class GeoapifyGeocodingClient {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (!apiKey.trim()) throw new Error('GEOAPIFY_API_KEY_REQUIRED');
  }

  async geocode(address: NormalizedSwedishAddress): Promise<GeocodedAddress> {
    const params = new URLSearchParams({
      street: address.street,
      housenumber: address.houseNumber,
      postcode: address.postalCode,
      city: address.city,
      country: address.country,
      filter: 'countrycode:se',
      lang: 'sv',
      limit: '10',
      format: 'json',
      apiKey: this.apiKey,
    });

    const url = 'https://api.geoapify.com/v1/geocode/search?' + params.toString();

    const response = await this.fetchImpl(url, {
      headers: { accept: 'application/json' },
    });

    if (!response.ok) throw new Error('GEOAPIFY_HTTP_' + response.status);

    const payload = await response.json() as {
      results?: GeoapifyResult[];
    };

    const results = Array.isArray(payload.results) ? payload.results : [];

    const exact = results.find((result) => {
      const coordinatesValid =
        typeof result.lat === 'number' &&
        typeof result.lon === 'number' &&
        Number.isFinite(result.lat) &&
        Number.isFinite(result.lon) &&
        result.lat >= -90 &&
        result.lat <= 90 &&
        result.lon >= -180 &&
        result.lon <= 180;

      return coordinatesValid && isExactAddressMatch(result, address);
    });

    if (!exact) throw new Error('ADDRESS_NOT_RESOLVED');

    return {
      latitude: exact.lat!,
      longitude: exact.lon!,
      formattedAddress: exact.formatted?.trim() || address.canonicalAddress,
      placeId: exact.place_id?.trim() || null,
    };
  }
}
