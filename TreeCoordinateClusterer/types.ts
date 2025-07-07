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