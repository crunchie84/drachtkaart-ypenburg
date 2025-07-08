import { sorted_points } from './sortCoordinatesOfPolygon';
import { quickHull } from './quickhull';

// POLYGON((a),(b),(c),(a)) = shape
// we only need the outermost coordinates to form the shape.

export function toWKT(cluster: {latitude: number, longitude: number}[]): string {
  const coords = cluster.map(p => `${p.longitude} ${p.latitude}`);
  if (coords.length === 1) {
    return `POINT(${coords[0]})`;
  }
  else if (coords.length <=3) {
    // return `LINESTRING(${coords.map(c => `${c}`).join(', ')})`;
    return `MULTIPOINT(${coords.map(c => `${c}`).join(', ')})`;
    // TODO; how to inflate LINESTRING into an AREA?
  } else {
    // find the outside of the polygon using quickHull algorithm
    const hullOfPolygon = quickHull(cluster.map((coord) => ([coord.longitude, coord.latitude])));
    const sortedPointsOfPolygon = sorted_points(hullOfPolygon.map(el => ({ x: el[0], y: el[1]})));
    sortedPointsOfPolygon.push(sortedPointsOfPolygon[0]); // to close the loop in the polygon
    return `POLYGON((${sortedPointsOfPolygon.map((i) => `${i.x} ${i.y}`).join(', ')}))`;
    // return `MULTIPOINT(${coords.map(c => `${c}`).join(', ')})`;
    // return `POLYGON(${coords.map(c => `(${c})`).join(', ')})`;
    // return `GEOMETRYCOLLECTION(${coords.map(c => `POINT(${c})`).join(', ')})`;
  }
}

// MULTIPOINT werkt maar toont gewoon de losse markers ipv vlakken
// POLYGON - moet deze meer dan 2 coordinaten hebben? hoe is de format hierin?