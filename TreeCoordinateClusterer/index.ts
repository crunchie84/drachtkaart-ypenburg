import * as fs from 'fs';
import * as path from 'path';
import * as process from 'process';
import { getDistance } from 'geolib';

import { groupBy } from './groupBy';

interface GeoItem {
  title: string;
  body: string;
  Pollenwaarde: string;
  Nectarwaarde: string;
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
const result = groupTreesByKindAndCluster(data);

// console.log('results: ');
// result.forEach((clustersOfTreeKind => {
//     console.log(`tree kind = "${clustersOfTreeKind.kind}", clusters #=${clustersOfTreeKind.clusters.length}`)
// }));
console.log(JSON.stringify(toOutputObjectArray(result), undefined, '  '));


interface outputType {
    title: string;
    body: string;
    Pollenwaarde: string;
    Nectarwaarde: string;
    WKT: string;
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
        };

        clusters.forEach(cluster => {
            const clustersSerialized2WKT = toWKT(cluster);
            acc.push({
                ...metadata,
                WKT: clustersSerialized2WKT
            });
        });
        return acc;
    }, new Array<outputType>());
}

function groupCoordinatesIntoClusters(items: GeoItem[], maxDistanceItemsIngroupInMeters: number): GeoItem[][] {
    const clustersOfCoordinatesNearEnough = items.reduce((clusters, currentCoordinate) => {
        // for each item in the group, 
        // find a cluster where we can find an item with a min_distance_to = xxMeters
        // if found add the tree to that cluster
        // else create a new cluster
        
        const clusterToAddItemTo = clusters.find((clusterOfCoordinates) => {
            // find a cluster where we already have a tree with min_distance_to=5m
            return clusterOfCoordinates.some((coordinateInCluster) => {
                // console.log(`going to test distance between (${currentCoordinate.latitude} ${currentCoordinate.longitude}) and (${coordinateInCluster.latitude} ${coordinateInCluster.longitude})`);

                // getDistance Distance values are always floats and represent the distance in meters.
                return getDistance(
                    { latitude: currentCoordinate.latitude, longitude: currentCoordinate.longitude },
                    { latitude: coordinateInCluster.latitude, longitude: coordinateInCluster.longitude }
                ) < maxDistanceItemsIngroupInMeters
            })
        }) || [];

        if (clusterToAddItemTo.length === 0) {
            // console.log('- Creating new cluster, could not find any where trees are < 5m apart');
            clusters.push(clusterToAddItemTo);
        }

        clusterToAddItemTo.push(currentCoordinate);//add the tree to the cluster

        return clusters;
    }, new Array<GeoItem[]>());

    return clustersOfCoordinatesNearEnough;
}

function groupTreesByKindAndCluster(items: GeoItem[]): Array<{ treeKind: GeoItem, clusters: GeoItem[][]}> {
    // group all GeoItems based on SoortNaam
    const groupedData = groupBy(items, (i => i.title));

    const result = groupedData.map((groupedTrees) => {
        const soort = groupedTrees.key;
        // console.log(`Going to cluster trees of type ${soort}...`);
        const maxDistanceToOtherTreesInMeters = 25;

        const clustersOfTreeKind = groupCoordinatesIntoClusters(groupedTrees.items, maxDistanceToOtherTreesInMeters);

        return {
            treeKind: items.find(i => i.title === soort) || {} as GeoItem, // cheats to fix the nullref typescript assumption
            clusters: clustersOfTreeKind
        }
    });

    return result;
}


function toWKT(cluster: GeoItem[]): string {
  const coords = cluster.map(p => `${p.longitude} ${p.latitude}`);
  if (coords.length === 1) {
    return `POINT(${coords[0]})`;
  }
  else if (coords.length === 2) {
    return `LINESTRING(${coords.map(c => `${c}`).join(', ')})`;
  } else {
    return `MULTIPOINT(${coords.map(c => `${c}`).join(', ')})`;
    // return `POLYGON(${coords.map(c => `(${c})`).join(', ')})`;
    // return `GEOMETRYCOLLECTION(${coords.map(c => `POINT(${c})`).join(', ')})`;
  }
}

// MULTIPOINT werkt maar toont gewoon de losse markers ipv vlakken
// POLYGON - moet deze meer dan 2 coordinaten hebben? hoe is de format hierin?