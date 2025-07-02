import * as fs from 'fs';
import * as path from 'path';
import * as process from 'process';

import { getDistance } from 'geolib';
import { quickHull } from "@derschmale/tympanum";

import { groupBy } from './groupBy';
import { Point, quickHull2, quickHull3 } from './quickhull';


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


// own implementation but the sorting of the coordinates is a bit tricky...
const hullOfPolygon = quickHull3([
    [4.38982636755271,52.04616984897392],
    [4.389986894883828,52.0461622196863],
    [4.389900444595737,52.04611654424774],
    [4.389984693131365,52.04626107647968],
    [4.389752490539375,52.04621416667192],
    [4.389910816122934,52.04630539427641],
    [4.38976486350936,52.04631314690405],
    [4.390058770138237,52.04620777165455],
    [4.389836738778208,52.0463586990068],
    [4.389678413158496,52.046267471303366]
]);
//console.log(JSON.stringify(hullOfPolygon));
// sort the coordinates, every time we need the next element that is closest to the previous element

const sorted = sortCoordinatesIntoLinkedOuterPerimeterOfHull(hullOfPolygon);
console.log('SORTED => ' + JSON.stringify(sorted));
sorted.push(sorted[0]);


console.log(`POLYGON((${sorted.map((i, idx) => `${i[0]} ${i[1]}`).join(', ')}))`);
// console.log(`POLYGON(${result.concat(result[0]).map(i => `${i[0]} ${i[1]}`).join(', ')})`);




function sortCoordinatesIntoLinkedOuterPerimeterOfHull(input: number[][]): number[][] {
    const sortedListOfCoordinates = new Array<number[]>();

    let currentCoordinate: number[] = input.pop() as number[];
    if(currentCoordinate !== undefined){
        sortedListOfCoordinates.push(currentCoordinate);

        while(input.length > 0) {
            console.log(`found coordinate "${currentCoordinate[0]} ${currentCoordinate[1]}"`)
            // find the next element that is closest to the currentElement so it can become the next currentelement
            const sortedDistanceToOtherCoordinates = input
                .map((coordinate, idx) => ({
                    originalIndex: idx,
                    distanceToCurrentCoordinate: getDistance(
                        {latitude: currentCoordinate[0], longitude: currentCoordinate[1]},
                        {latitude: coordinate[0], longitude: coordinate[1]}
                    )
                }))
                .sort((a, b) => a.distanceToCurrentCoordinate - b.distanceToCurrentCoordinate);
            
            console.log('distances sorted: ' + JSON.stringify(sortedDistanceToOtherCoordinates, null, ' '));


            currentCoordinate = input[sortedDistanceToOtherCoordinates[0].originalIndex];
            console.log(`found next coordinate "${currentCoordinate[0]} ${currentCoordinate[1]}" (distance to previous=${sortedDistanceToOtherCoordinates[0].distanceToCurrentCoordinate}m)`)
            
            if(currentCoordinate === undefined) 
                throw new Error('what happened');

            // remove the new currentCoordinate from the original input array
            input.splice(sortedDistanceToOtherCoordinates[0].originalIndex, 1);
            // add it to the sortedListOfCoordinates
            sortedListOfCoordinates.push(currentCoordinate);
        }        
    }
    return sortedListOfCoordinates;
}




// const filePath = path.resolve(args[0]);
// const rawData = fs.readFileSync(filePath, 'utf-8');

// const data: GeoItem[] = JSON.parse(rawData);
// const result = groupTreesByKindAndCluster(data);

// // console.log('results: ');
// // result.forEach((clustersOfTreeKind => {
// //     console.log(`tree kind = "${clustersOfTreeKind.kind}", clusters #=${clustersOfTreeKind.clusters.length}`)
// // }));
// console.log(JSON.stringify(toOutputObjectArray(result), undefined, '  '));


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

// POLYGON((a),(b),(c),(a)) = shape
// we only need the outermost coordinates to form the shape.


function toWKT(cluster: {latitude: number, longitude: number}[]): string {
  const coords = cluster.map(p => `${p.longitude} ${p.latitude}`);
  if (coords.length === 1) {
    return `POINT(${coords[0]})`;
  }
  else if (coords.length === 2) {
    return `LINESTRING(${coords.map(c => `${c}`).join(', ')})`;
  } else {
    // find the outside of the polygon using quickHull algorithm
    // const points = cluster.map(i => [i.latitude, i.longitude]);
    // const hull = quickHull(points);
    // const firstFacet = hull[0]; // needed to join to the list
    // firstFacet.verts[]
    // hull.concat(firstFacet).map(facet => `${facet.ridges[0].}`)

    // hull.map(facet => )




    return `MULTIPOINT(${coords.map(c => `${c}`).join(', ')})`;
    // return `POLYGON(${coords.map(c => `(${c})`).join(', ')})`;
    // return `GEOMETRYCOLLECTION(${coords.map(c => `POINT(${c})`).join(', ')})`;
  }
}

// MULTIPOINT werkt maar toont gewoon de losse markers ipv vlakken
// POLYGON - moet deze meer dan 2 coordinaten hebben? hoe is de format hierin?