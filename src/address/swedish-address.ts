export type SwedishAddressInput = {
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  apartmentOrFloor?: string | null;
  country?: string;
};

export type NormalizedSwedishAddress = {
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  apartmentOrFloor: string | null;
  country: string;
  canonicalAddress: string;
};

function clean(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function normalizeSwedishPostalCode(value: string): string {
  const compact = clean(value).replace(/\s+/g, '');
  if (!/^\d{5}$/.test(compact)) throw new Error('INVALID_SWEDISH_POSTAL_CODE');
  return `${compact.slice(0, 3)} ${compact.slice(3)}`;
}

export function normalizeSwedishAddress(input: SwedishAddressInput): NormalizedSwedishAddress {
  const street = clean(input.street);
  const houseNumber = clean(input.houseNumber);
  const city = clean(input.city);
  const apartmentOrFloor = clean(input.apartmentOrFloor) || null;
  const country = clean(input.country) || 'Sweden';

  if (!street) throw new Error('STREET_REQUIRED');
  if (!houseNumber) throw new Error('HOUSE_NUMBER_REQUIRED');
  if (!city) throw new Error('CITY_REQUIRED');

  const postalCode = normalizeSwedishPostalCode(input.postalCode);
  const canonicalAddress = `${street} ${houseNumber}, ${postalCode} ${city}, ${country}`;

  return {
    street,
    houseNumber,
    postalCode,
    city,
    apartmentOrFloor,
    country,
    canonicalAddress,
  };
}
