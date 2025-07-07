import { getDistance, latitudeKeys } from "geolib";
import { quickHull } from "./quickhull";
import { sorted_points } from "./sortCoordinatesOfPolygon";
import { Coordinate, distanceCache, GeoItem } from "./types";

export function clusterTreesWithoutOverlappingOtherClusters(currentItems: GeoItem[], allItems: GeoItem[], maxDistanceBetweenTreesInMeters: number, distanceCache: distanceCache): GeoItem[][]{
    //while currentItems has remaining items
    // create a new cluster using the first coordinate of the remaining Items
    // while succesfully added last coordinate to the new cluster
    //  - try to add next nearest coordinate to the cluster
    //  - while other coordinates still available, try those to
    //  - success if:    
    //  try to add the nearest coordinate to the cluster from the remaining Items
    //  it succeeds if:
    //  - we have less then 3 coordinates (no bouding box to be created)
    //  - we can create the bounding box / polygon using quickHull without having any other item from the allItems be inside the polygon
    //  When it succeeds add the coordinate to the cluster and repeat
    // else create a new cluster using the currently selected nearest coordinate


    const otherItems = allItems.filter(i => i.title != currentItems[0].title);

    const clusters = new Array<GeoItem[]>();
    let remainingItems = currentItems;
    while(remainingItems.length > 0) {
        const result = clusterItems(remainingItems, otherItems, maxDistanceBetweenTreesInMeters, distanceCache);
        remainingItems = result.remainingItems;
        const nextCluster = result.clusteredItems;
        
console.log(`next cluster size=${nextCluster.length}, remainingItemsToCluster=${remainingItems.length}`)
        clusters.push(nextCluster);
    }
    return clusters;
}

function createDistanceCacheKey(a: Coordinate, b: Coordinate) {
    // sort them always in the same way
    return JSON.stringify([a.latitude, a.longitude,b.latitude, b.longitude].sort());
}

export function calculateDistanceCache(allCoordinates: Coordinate[]): distanceCache {
console.log("calculating distance from all coordinates to all coordinates... sit tight, this will take a while....")
const total = allCoordinates.length * allCoordinates.length;
let i = 0;

    const result: distanceCache = {};
    allCoordinates.forEach((coord) => {
        allCoordinates
            .forEach((otherCoord) => {
                i++;
                if(i %100000 === 0) console.log(`${i}/${total}`)
                const cacheKey = createDistanceCacheKey(coord, otherCoord);
                if(result[cacheKey] === undefined){
                    result[cacheKey] = getDistance(coord, otherCoord)
                }
            });
    });
console.log('cache calculated');
    return result;
}


function sortCandidatesOnShortestDistanceToCurrentCoordinatesOfCluster(coordinatesOfCluster: GeoItem[], remainingNonClusteredItems: GeoItem[], distanceCache: distanceCache){
    const sorted = remainingNonClusteredItems
            .map(candidateCoordinate => {
                const closestDistanceToAnyOfOurCoordinates = coordinatesOfCluster
                    .map(currentCoordinateOfCluster => {
                        if(distanceCache !== undefined ){
                            const cachekey = createDistanceCacheKey(currentCoordinateOfCluster, candidateCoordinate);
                            if(distanceCache[cachekey] === undefined) {
                                console.log(`cache miss!, adding to cache ${cachekey}`);
                                distanceCache[cachekey] = getDistance(currentCoordinateOfCluster, candidateCoordinate);
                            }
                            return distanceCache[cachekey];
                        }

                        return getDistance(
                            { latitude: currentCoordinateOfCluster.latitude, longitude: currentCoordinateOfCluster.longitude },
                            { latitude: candidateCoordinate.latitude, longitude: candidateCoordinate.longitude }
                        )
                    })
                    .sort((a, b) => a - b)[0];

                return {
                    item: candidateCoordinate,
                    closestDistanceToAnyOfOurCoordinates: closestDistanceToAnyOfOurCoordinates
                }
            })
            .sort((a,b) => a.closestDistanceToAnyOfOurCoordinates - b.closestDistanceToAnyOfOurCoordinates);
    return sorted;
}

/**
 * Determines if a point is inside a polygon using the ray-casting algorithm.
 * 
 * @param point 
 * @param polygon 
 * @returns 
 */
function isPointInPolygon(point: Coordinate, polygon: Coordinate[]) {
    const num_vertices = polygon.length;
    const x = point.latitude;
    const y = point.longitude;
    let inside = false;

    let p1: Coordinate = polygon[0];
    let p2: Coordinate;

    for (let i = 1; i <= num_vertices; i++) {
        p2 = polygon[i % num_vertices];

        if (y > Math.min(p1.longitude, p2.longitude)) {
            if (y <= Math.max(p1.longitude, p2.longitude)) {
                if (x <= Math.max(p1.latitude, p2.latitude)) {
                    const x_intersection = ((y - p1.latitude) * (p2.latitude - p1.latitude)) / (p2.longitude - p1.longitude) + p1.latitude;

                    if (p1.latitude === p2.latitude || x <= x_intersection) {
                        inside = !inside;
                    }
                }
            }
        }

        p1 = p2;
    }

    return inside;
}


function growingToCoordinateCreatesPolygonWitoutOverlapInOtherTypesOfCoordinate(currentCluster: GeoItem[], candidate: GeoItem, itemsOfOtherTypes: GeoItem[]): boolean {
    if(currentCluster.length + 1 <= 3){
        return true;// les then 3 edges can not create a polygon
    }

    // generate polygon based on our list of coordinates
    const hullOfPolygon = quickHull(currentCluster.concat(candidate).map((coord) => ([coord.latitude, coord.longitude]))); // is this right? long/lat i/o lat/lon
    const polygon = hullOfPolygon.map<Coordinate>(i => ({ latitude: i[0], longitude: i[1] }));
    // const sortedPointsOfPolygon = sorted_points(hullOfPolygon.map(el => ({ x: el[0], y: el[1]})))
    //     .map<Coordinate>(i => ({ latitude: i.x, longitude: i.y }))
//console.log(JSON.stringify(sortedPointsOfPolygon));
    // determine if we can find any coordinates in the list of itemsOfOtherTypes which are in bounds of our polygon

    const polygonContainsCoordinateOfOtherType = itemsOfOtherTypes.some((otherItem) => isPointInPolygon(otherItem, polygon));
    return !polygonContainsCoordinateOfOtherType;
}

function clusterItems(remainingItems: GeoItem[], itemsOfOtherTypes: GeoItem[], maxDistanceBetweenTreesInMeters: number, distanceCache: distanceCache) : {remainingItems: GeoItem[], clusteredItems: GeoItem[]} {
    if(remainingItems.length === 0) {
        throw new Error('clustering can only be done with > 0 items to cluster');
    }
    const cluster = [remainingItems.pop()];

// console.log(`Starting new cluster, starting at ${cluster[0].latitude} ${cluster[0].longitude}. RemainingItems.length=${remainingItems.length} (${cluster[0].title})`);

    let clusterOptionsAreExhausted = false;
    while (remainingItems.length > 0 && clusterOptionsAreExhausted === false) {
        // sort the remaining items on closestdistance to _any_ of our coordinates
        let remainingItemsSortedClosestToOurCurrentClusterCoordinates = sortCandidatesOnShortestDistanceToCurrentCoordinatesOfCluster(cluster, remainingItems, distanceCache);

        // if we do not have a polygon yet (size = 3) then we use the max distance calculation between trees
        // to prevent arbitrary datapoints from forming a cluster across the map
        // once we have a few datapoints set up we allow the polygon to grow to the size it can become
        // as long as it does not start to contain trees of other kinds
        if (cluster.length <= 3) {
            remainingItemsSortedClosestToOurCurrentClusterCoordinates = remainingItemsSortedClosestToOurCurrentClusterCoordinates.filter(itm => itm.closestDistanceToAnyOfOurCoordinates <= maxDistanceBetweenTreesInMeters);
        }

        // while we have not found a coordinate we can add:
        let succesfullyAddedCoordinateToCluster = false;
        while (remainingItemsSortedClosestToOurCurrentClusterCoordinates.length > 0 && !succesfullyAddedCoordinateToCluster) {
            succesfullyAddedCoordinateToCluster = false; // reset after each iteration

            // find the nearest coordinate to any of our coordinates in the current cluster) and try to add it
            // if no more candidates are available we have reached our max cluster size and shouldContinue=false
            const candidateToAdd = remainingItemsSortedClosestToOurCurrentClusterCoordinates.shift().item;
            if (growingToCoordinateCreatesPolygonWitoutOverlapInOtherTypesOfCoordinate(cluster, candidateToAdd, itemsOfOtherTypes)){
// console.log(` - found coordinate we can add without causing overlap with coordinates of other type: ${candidateToAdd.latitude} ${candidateToAdd.longitude} `);
                succesfullyAddedCoordinateToCluster = true;

                // its a match, we can add it to our cluster!
                cluster.push(candidateToAdd);

                // TODO: verify that we are able to mutate the remaining items in this scope
                const assertLengthBefore = remainingItems.length;
                remainingItems = remainingItems.filter(i => i.latitude !== candidateToAdd.latitude && i.longitude !== candidateToAdd.longitude);
                if(assertLengthBefore === remainingItems.length) {
                    throw new Error("did not correctly remove candidate added to cluster from the source list items");
                }
            }
        }
        
        // console.log(`here: c=${cluster.length}, succesfullyAddedCoordinateToCluster=${succesfullyAddedCoordinateToCluster}, remainingItems=${remainingItems.length}`)
        
        // if after we tried all candidates based on distance we did not get at least one coordinate added to the cluster
        if (remainingItemsSortedClosestToOurCurrentClusterCoordinates.length === 0 || !succesfullyAddedCoordinateToCluster) {
            // we did not succeed in growing the cluster further, skip iterating, return what we have as the current cluster
            clusterOptionsAreExhausted = true;
        }
    }

    return {
        remainingItems,
        clusteredItems: cluster
    }
}
