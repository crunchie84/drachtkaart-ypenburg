import * as fs from 'fs';
import * as path from 'path';
import * as process from 'process';

import { getDistance } from 'geolib';

import { groupBy } from './groupBy';

import { Coordinate, GeoItem } from './types';
import { clusterTreesWithoutOverlappingOtherClusters } from './clusterCoordinates';
import { toWKT } from './outputFormatters';

// const v8 = require('node:v8');
// const { heap_size_limit } = v8.getHeapStatistics();
// const heapSizeInGB = heap_size_limit / (1024 * 1024 * 1024);
// console.log(`${heapSizeInGB} GB`);


const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('Please provide a path to a JSON file.');
    process.exit(1);
}
const filePath = path.resolve(args[0]);
const rawData = fs.readFileSync(filePath, 'utf-8');

const data: GeoItem[] = JSON.parse(rawData);
const maxDistanceToOtherTreesInMeters = 100;//crossings/roads in NL seem to be 30m spacing of trees

const debugging = false;
if(debugging) {
    const debugPolygon = ["52.0273267472761 4.37307969465699","52.0273061947089 4.37287882148708","52.0271903852604 4.37293747232614","52.0270104347336 4.37377949240016","52.0277038217237 4.37380001552899","52.028653604916 4.37428690877909","52.0281714506803 4.37327306014986","52.0281265361635 4.37317207242521"]
    const treesInPolygon = ["52.0274250925171 4.37351597825935","52.027386847326 4.3733376686683"]
    function debugOutput(polygonPointsToCheck: Array<string>, coordinatesWhichShouldNotBeInPolygon: Array<string>) {
        function toGeoItem(i: string, title: string): GeoItem {
            const parts = i.split(' ');
            return {
                title: title,
                body: '',
                Pollenwaarde: undefined,
                Nectarwaarde: undefined,
                EindeBloei: undefined,
                StartBloei: undefined,
                latitude: parseFloat(parts[0]), 
                longitude: parseFloat(parts[1])
            };
        }

        const debugPolygon = polygonPointsToCheck.map<GeoItem>(i => toGeoItem(i, 'WrongPolygonTreeType'));
        const treesInPolygon = coordinatesWhichShouldNotBeInPolygon.map<GeoItem>(i => toGeoItem(i, 'OtherTreeType'));

        const result = groupTreesByKindAndCluster(debugPolygon.concat(treesInPolygon), maxDistanceToOtherTreesInMeters);
        console.log('FINAL WKT OUTPUT: ');
        console.log(`GEOMETRYCOLLECTION (${toOutputObjectArray(result).map(i => i.WKT).join(', ')})`);
    }
    debugOutput(debugPolygon, treesInPolygon);
}
else {
    // FINAL VERSION HERE:
    const result = groupTreesByKindAndCluster(data, maxDistanceToOtherTreesInMeters);
    console.log(JSON.stringify(toOutputObjectArray(result), undefined, '  '));
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

    // debug info
    // const treeKindsCount = groupedData.length;
    // let treeKindsDone = 0;

    const result = groupedData
    .map((groupedTrees) => {
// console.log(`clustering tree kind ${treeKindsDone++}/${treeKindsCount} (containing #${groupedTrees.items.length} trees) - "${groupedTrees.key}"`)
        const soort = groupedTrees.key;

        //const clustersOfTreeKind = groupCoordinatesIntoClusters(groupedTrees.items, maxDistanceToOtherTreesInMeters);
        const clustersOfTreeKind = clusterTreesWithoutOverlappingOtherClusters(groupedTrees.items, items, maxDistanceToOtherTreesInMeters);

        return {
            treeKind: items.find(i => i.title === soort) || {} as GeoItem, // cheats to fix the nullref typescript assumption
            clusters: clustersOfTreeKind
        }
    });

    return result;
}

