import type { NormalizedSwedishAddress } from '../address/swedish-address.js';

export type GeocodedAddress = {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  placeId: string | null;
};

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
      limit: '5',
      format: 'json',
      apiKey: this.apiKey,
    });

    const response = await this.fetchImpl(
      'https://api.geoapify.com/v1/geocode/search?' + params.toString(),
      { headers: { accept: 'application/json' } },
    );

    if (!response.ok) throw new Error('GEOAPIFY_HTTP_' + response.status);

    const payload = await response.json() as {
      results?: Array<{
        lat?: number;
        lon?: number;
        formatted?: string;
        place_id?: string;
      }>;
    };

    const best = (payload.results ?? []).find((r) =>
      typeof r.lat === 'number' &&
      typeof r.lon === 'number' &&
      Number.isFinite(r.lat) &&
      Number.isFinite(r.lon)
    );

    if (!best) throw new Error('ADDRESS_NOT_RESOLVED');

    return {
      latitude: best.lat!,
      longitude: best.lon!,
      formattedAddress: best.formatted?.trim() || address.canonicalAddress,
      placeId: best.place_id?.trim() || null,
    };
  }
}