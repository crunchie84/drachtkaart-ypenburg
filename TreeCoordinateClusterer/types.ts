export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface GeoItem extends Coordinate{
  title: string;
  body: string;
  Pollenwaarde: number;
  Nectarwaarde: number;
  StartBloei: number;
  EindeBloei: number;
}

export interface distanceCache { [index: string]: number };
// export type distanceCache = Array<{a:Coordinate,b:Coordinate, distanceInMeters:number }>;