import * as fs from 'fs';
import * as path from 'path';
import * as process from 'process';

import { getDistance } from 'geolib';

import { groupBy } from './groupBy';
import { quickHull } from './quickhull';


interface GeoItem {
  title: string;
  body: string;
  Pollenwaarde: number;
  Nectarwaarde: number;
  StartBloei: number;
  EindeBloei: number;
  latitude: number;
  longitude: number;
}

const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('Please provide a path to a JSON file.');
    process.exit(1);
}
const filePath = path.resolve(args[0]);
const rawData = fs.readFileSync(filePath, 'utf-8');

const data: GeoItem[] = JSON.parse(rawData);
const maxDistanceToOtherTreesInMeters = 100;//crossings/roads in NL seem to be 30m spacing of trees
const result = groupTreesByKindAndCluster(data, maxDistanceToOtherTreesInMeters);

console.log(JSON.stringify(toOutputObjectArray(result), undefined, '  '));


// code from https://stackoverflow.com/a/2859695/106909
// given a list of [x,y] order these to create a circulair outline
function sorted_points(points: Array<{x: number, y: number}>): Array<{x: number, y: number}> {
    points = points.slice(0); // copy the array, since sort() modifies it
    const stringify_point = function(p) { return p.x + ',' + p.y; };

    // finds a point in the interior of `pts`
    const avg_points = function(pts) {
        let x = 0;
        let y = 0;
        for (let i = 0; i < pts.length; i++) {
            x += pts[i].x;
            y += pts[i].y;
        }
        return {x: x/pts.length, y:y/pts.length};
    }
    const center = avg_points(points);

    // calculate the angle between each point and the centerpoint, and sort by those angles
    const angles = {};
    for(let i = 0; i < points.length; i++) {
        angles[stringify_point(points[i])] = Math.atan2(points[i].x - center.x, points[i].y - center.y);
    }
    points.sort(function(p1, p2) {
        return angles[stringify_point(p1)] - angles[stringify_point(p2)];
    });
    return points;
}

interface outputType {
    title: string;
    body: string;
    Pollenwaarde: number;
    Nectarwaarde: number;
    AantalBomen: number;
    StartBloei: number;
    EindeBloei: number;
    WKT: string;
    DebugInfo: string;
}

type clusteredTreesPerKind = Array<{ treeKind: GeoItem, clusters: GeoItem[][]}>;

function toOutputObjectArray(clusteredTrees: clusteredTreesPerKind): outputType[] {
    return clusteredTrees.reduce((acc, currentTreeKindClusters) => {
        const clusters = currentTreeKindClusters.clusters;
        const treeKind = currentTreeKindClusters.treeKind;

        const metadata = {
            title: treeKind.title,
            body: treeKind.body,
            Pollenwaarde: treeKind.Pollenwaarde,
            Nectarwaarde: treeKind.Nectarwaarde,
            StartBloei: treeKind.StartBloei,
            EindeBloei: treeKind.EindeBloei,
        };

        clusters.forEach(cluster => {
            const clustersSerialized2WKT = toWKT(cluster);
            acc.push({
                ...metadata,
                WKT: clustersSerialized2WKT,
                AantalBomen: cluster.length,
                DebugInfo: JSON.stringify(cluster.map(i => `${i.latitude} ${i.longitude}`))
            });
        });
        return acc;
    }, new Array<outputType>());
}

function findNearbyCoordinatesRecursive(coordinateToSearchFrom: GeoItem, allCoordinates: GeoItem[], maxDistanceItemsInGroupInMeters: number, isDebugMode: boolean): GeoItem[] {
    // find all coordinates which are in reach of our current coordinate
    const nearbyCoordinates = allCoordinates.filter((currentCoordinate) => {
            return (currentCoordinate.latitude != coordinateToSearchFrom.latitude && currentCoordinate.longitude != coordinateToSearchFrom.latitude)
            && getDistance(
                { latitude: coordinateToSearchFrom.latitude, longitude: coordinateToSearchFrom.longitude },
                { latitude: currentCoordinate.latitude, longitude: currentCoordinate.longitude }
            ) < maxDistanceItemsInGroupInMeters
    });
    if(isDebugMode){
        console.log(`from ${coordinateToSearchFrom.latitude} ${coordinateToSearchFrom.longitude} found ${nearbyCoordinates.length} coordinates within distance: ${JSON.stringify(nearbyCoordinates.map(i => [i.latitude, i.longitude]))}`)
    }

    // remove them from the allCoordinates array to stop recursion in the future
    // Note; we do this first so we don't get duplicates by going back-n-forth between two coordinates when iterating / recursing
    nearbyCoordinates.forEach((coordinateToRemove) => {
        const indexOfItemInSourceList = allCoordinates.indexOf(coordinateToRemove);
        if(indexOfItemInSourceList < 0) throw new Error(`Assertion; item "${coordinateToRemove.latitude} ${coordinateToRemove.longitude}" came from source list so index should be found in source list`);
        allCoordinates.splice(indexOfItemInSourceList, 1);
    });

    // for each we found, recurse to find more coordinates // or no-op when no more coordinates found
    const result = new Array<GeoItem>();
    nearbyCoordinates.forEach((coordinateToRecurseFrom) => {
        result.push(coordinateToRecurseFrom);
        const nearbyFromThisCoordinate = findNearbyCoordinatesRecursive(coordinateToRecurseFrom, allCoordinates, maxDistanceItemsInGroupInMeters, isDebugMode);
        result.push(...nearbyFromThisCoordinate);
    });
    return result;
}

function groupCoordinatesIntoClusters(items: GeoItem[], maxDistanceItemsInGroupInMeters: number): GeoItem[][] {
    const clusters = new Array<GeoItem[]>();
    const source = [...items];
    let isDebugMode = false;
    // console.log(`clustering trees of kind ${items[0].title} - total coordinates to cluster=#${coordinatesStartedWith}`);
    
    while(source.length > 0) {
        const currentCoordinateToStartClusterWith = source.pop();// take a remaining item
        // isDebugMode = `${currentCoordinateToStartClusterWith.latitude} ${currentCoordinateToStartClusterWith.longitude}` === "52.0271616555834 4.37494089268015";

        const cluster = [currentCoordinateToStartClusterWith].concat(findNearbyCoordinatesRecursive(currentCoordinateToStartClusterWith, source, maxDistanceItemsInGroupInMeters, isDebugMode));
        clusters.push(cluster);

        if(isDebugMode){
            console.log(`- cluster done, seed="${currentCoordinateToStartClusterWith.latitude} ${currentCoordinateToStartClusterWith.longitude}", found total #${cluster.length} coordinates (${JSON.stringify(cluster.map(i => [i.latitude, i.longitude]))})`);
            console.log(`- remaining coordinates to cluster: ${source.length}`);
        }
    }

    return clusters;
}

function groupTreesByKindAndCluster(items: GeoItem[], maxDistanceToOtherTreesInMeters: number): Array<{ treeKind: GeoItem, clusters: GeoItem[][]}> {
    // group all GeoItems based on SoortNaam
    const groupedData = groupBy(items, (i => i.title));

    const result = groupedData.map((groupedTrees) => {
        const soort = groupedTrees.key;

        const clustersOfTreeKind = groupCoordinatesIntoClusters(groupedTrees.items, maxDistanceToOtherTreesInMeters);

        return {
            treeKind: items.find(i => i.title === soort) || {} as GeoItem, // cheats to fix the nullref typescript assumption
            clusters: clustersOfTreeKind
        }
    });

    return result;
}

// POLYGON((a),(b),(c),(a)) = shape
// we only need the outermost coordinates to form the shape.

function toWKT(cluster: {latitude: number, longitude: number}[]): string {
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