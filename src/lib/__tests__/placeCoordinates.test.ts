import { describe, expect, it } from 'vitest';
import { parsePlaceCoordinates } from '../placeCoordinates';

describe('place coordinates', () => {
  it('accepts decimal pairs and OpenStreetMap marker or map links', () => {
    expect(parsePlaceCoordinates('55.75, 37.62')).toEqual({lat:55.75,lon:37.62});
    expect(parsePlaceCoordinates('55,75; 37,62')).toEqual({lat:55.75,lon:37.62});
    expect(parsePlaceCoordinates('https://www.openstreetmap.org/#map=16/55.75/37.62')).toEqual({lat:55.75,lon:37.62});
    expect(parsePlaceCoordinates('https://www.openstreetmap.org/?mlat=0&mlon=0#map=16/55.75/37.62')).toEqual({lat:0,lon:0});
  });
  it('rejects invalid and ambiguous data without inventing coordinates', () => {
    for (const value of ['91, 37','55,75, 37,62','55.75,181','https://example.com/#map=16/55/37','https://www.openstreetmap.org/?mlat=1','']) expect(parsePlaceCoordinates(value)).toBeNull();
  });
});
