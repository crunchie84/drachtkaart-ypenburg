import * as fs from 'fs';
import * as path from 'path';
import * as process from 'process';
import { getDistance } from 'geolib';

import { groupBy } from './groupBy';

interface GeoItem {
  title: string;
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

console.log('clustering...');

const result = groupTreesByKindAndCluster(data);
console.log('results: ');
result.forEach((clustersOfTreeKind => {
    console.log(`tree kind = "${clustersOfTreeKind.kind}", clusters #=${clustersOfTreeKind.clusters.length}`)
}));


function getDistance2(a: GeoItem,b: GeoItem): number {
    return getDistance(
        { latitude: a.latitude, longitude: a.longitude },
        { latitude: b.latitude, longitude: b.longitude }
    );
}


function groupCoordinatesIntoClusters(items: GeoItem[], maxDistanceItemsIngroupInMeters: number): GeoItem[][] {
    const clustersOfCoordinatesNearEnough = items.reduce((clusters, currentCoordinate) => {
        // for each item in the group, 
        // find a cluster where we can find an item with a min_distance_to = 5m
        // if found add the tree to that cluster
        // else create a new cluster
        
        const clusterToAddItemTo = clusters.find((clusterOfCoordinates) => {
            // find a cluster where we already have a tree with min_distance_to=5m
            return clusterOfCoordinates.some((coordinateInCluster) => {
                console.log(`going to test distance between (${currentCoordinate.latitude} ${currentCoordinate.longitude}) and (${coordinateInCluster.latitude} ${coordinateInCluster.longitude})`);

                // getDistance Distance values are always floats and represent the distance in meters.
                return getDistance(
                    { latitude: currentCoordinate.latitude, longitude: currentCoordinate.longitude },
                    { latitude: coordinateInCluster.latitude, longitude: coordinateInCluster.longitude }
                ) < maxDistanceItemsIngroupInMeters
            })
        }) || [];

        if (clusterToAddItemTo.length === 0) {
            console.log('- Creating new cluster, could not find any where trees are < 5m apart');
            clusters.push(clusterToAddItemTo);
        }

        clusterToAddItemTo.push(currentCoordinate);//add the tree to the cluster

        return clusters;
    }, new Array<GeoItem[]>());

    return clustersOfCoordinatesNearEnough;
}

function groupTreesByKindAndCluster(items: GeoItem[]): Array<{ kind: string, clusters: GeoItem[][]}> {
    // group all GeoItems based on SoortNaam
    const groupedData = groupBy(items, (i => i.title));

    const result = groupedData.map((groupedTrees) => {
        const soort = groupedTrees.key;
        console.log(`Going to cluster trees of type ${soort}...`);
        const minDistanceToOtherTreesInMeters = 5;

        const clustersOfTreeKind = groupCoordinatesIntoClusters(groupedTrees.items, minDistanceToOtherTreesInMeters);

        return {
            kind: soort,
            clusters: clustersOfTreeKind
        }
    });

    return result;
}


// function toWKT(cluster: Cluster): string {
//   const coords = cluster.points.map(p => `${p.lon} ${p.lat}`);
//   if (coords.length === 1) {
//     return `POINT(${coords[0]})`;
//   } else {
//     return `MULTIPOINT(${coords.map(c => `(${c})`).join(', ')})`;
//   }
// }

// // Output
// for (const [soortnaam, points] of grouped.entries()) {
//   const clusters = clusterWithoutOverlap(points);
//   for (const cluster of clusters) {
//     const wkt = toWKT(cluster);
//     console.log(`${cluster.soortnaam}: ${wkt}`);
//   }
// }
