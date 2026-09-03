/**
 * Extract { lat, lng } from a pasted Google Maps URL or a plain "lat, lng"
 * string. A fallback for users who already have the location on Google Maps.
 * Handles the common URL shapes:
 *   .../@23.3600,85.3300,15z            (map centre)
 *   ...!3d23.3600!4d85.3300             (place data)
 *   ...?q=23.3600,85.3300  / ll= / query=
 *   "23.3600, 85.3300"                  (plain paste)
 */
export interface Coords {
  lat: number;
  lng: number;
}

const IN_BOUNDS = (lat: number, lng: number) =>
  lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98;

const PATTERNS: RegExp[] = [
  /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/, // @lat,lng
  /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/, // !3dlat!4dlng
  /[?&](?:q|query|ll|destination|center)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/, // q=lat,lng
  /^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/, // plain "lat, lng"
];

export function extractCoords(input: string): Coords | null {
  if (!input) return null;
  for (const re of PATTERNS) {
    const m = input.match(re);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng) && IN_BOUNDS(lat, lng)) {
        return { lat, lng };
      }
    }
  }
  return null;
}
