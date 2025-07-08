import { getDistance, isPointInPolygon } from "geolib";
import { quickHull } from "./quickhull";
import { sorted_points } from "./sortCoordinatesOfPolygon";
import { Coordinate, GeoItem } from "./types";
import { toWKT } from "./outputFormatters";

export function clusterTreesWithoutOverlappingOtherClusters(currentItems: GeoItem[], allItems: GeoItem[], maxDistanceBetweenTreesInMeters: number): GeoItem[][]{
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
        const result = clusterItems(remainingItems, otherItems, maxDistanceBetweenTreesInMeters);
        remainingItems = result.remainingItems;
        const nextCluster = result.clusteredItems;
        
// console.log(`next cluster size=${nextCluster.length}, remainingItemsToCluster=${remainingItems.length}`)
        clusters.push(nextCluster);
    }
    return clusters;
}

function sortCandidatesOnShortestDistanceToCurrentCoordinatesOfCluster(coordinatesOfCluster: GeoItem[], remainingNonClusteredItems: GeoItem[]){
    const sorted = remainingNonClusteredItems
            .map(candidateCoordinate => {
                const closestDistanceToAnyOfOurCoordinates = coordinatesOfCluster
                    .map(currentCoordinateOfCluster => {
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

function coordinateToString(c: Coordinate) { return `${c.latitude} ${c.longitude}`}
function coordinateArrayToString(c: Coordinate[]) { return JSON.stringify(c.map(coordinateToString))}

/**
 * Determines if a point is inside a polygon using the ray-casting algorithm.
 * 
 * @param point 
 * @param polygon 
 * @returns 
 */
export function isPointInPolygon2(point: Coordinate, polygon: Coordinate[], debugModeIsEnabled:boolean) {
    if(debugModeIsEnabled) console.log(`[isPointInPolygon] checking if point ${coordinateToString(point)} is in polygon: ${coordinateArrayToString(polygon)}`)

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

    if(debugModeIsEnabled) console.log('point is inside of polygon='+inside);

    return inside;
}

function assertCoordinateIsInNLParameters(c: Coordinate): void {
    if(c.latitude <= 52  || c.latitude >= 53 || c.longitude <= 4 || c.longitude >= 5) {
        throw new Error(`AssertionFailed: latitude for NL should be [50-53], lon[4-5] but we got: "${coordinateToString(c)}"`);
    }
}


const debuggingPolygonCoordinates=["52.03693117789577 4.367980202087854","52.03697674326133 4.368052040108446","52.03684916012748 4.367850894019149","52.03680359463939 4.367779056407846","52.036760678204104 4.368013232084188","52.036706125869436 4.367941598975996","52.036304361788815 4.3682568126650025","52.0301376492175 4.37129619399812","52.03625879654584 4.368184975509081","52.03615867898267 4.368041506140097","52.03610412666267 4.367969873955228","52.03678709866188 4.3689891513691395","52.03674153386509 4.368917312693975","52.03688721507158 4.369132624868356","52.033811245177134 4.364772055535365","52.03151653413848 4.363439977647538","52.03141856456123 4.363544229144939","52.03139109701199 4.363486564112035","52.03135476918293 4.363443674830854","52.031318314642554 4.363386215351401","52.03128186007417 4.3633287559654725","52.03124553218764 4.3632858669166765","52.03120907757035 4.363228407705727","52.03139818348736 4.363267804312784","52.03127071890994 4.3630812671039365","52.031214642521405 4.362834805968036","52.03127653692991 4.36271680531272","52.03135615150722 4.362569252641849","52.03141817245775 4.362465821543966","52.03361618911348 4.365082560162595","52.0280061141163 4.37367649907766","52.0276391320893 4.37420012351558","52.0277339807317 4.37447481554615","52.03693277973718 4.369204463996188","52.0276521477889 4.374556432318"];
function growingToCoordinateCreatesPolygonWitoutOverlapWithCoordinatesOfOtherType(currentCluster: GeoItem[], candidate: GeoItem, itemsOfOtherTypes: GeoItem[]): boolean {
    const isDebugMode = false
    // const isDebugMode = currentCluster.concat(candidate).map(i => `${i.latitude} ${i.longitude}`).some(i => debuggingPolygonCoordinates.indexOf(i) > -1);

    if(isDebugMode) console.log(`debugmode enabled, checking if we can increase polygon with coordinates: ${candidate.latitude} ${candidate.longitude} (currentSizeOfCluster=${currentCluster.length}, countOfItemsOfOtherTypes=${itemsOfOtherTypes.length})`);
    
    if(currentCluster.length + 1 <= 3){
        if(isDebugMode) console.log('currentCluster length < 3, allowing to add to polygon');
        return true;// les then 3 edges can not create a polygon
    }

    // generate polygon based on our list of coordinates
    const hullOfPolygon = quickHull(currentCluster.concat(candidate).map((coord) => ([coord.latitude, coord.longitude]))); // is this right? long/lat i/o lat/lon
    // const hullOfPolygon = quickHull(currentCluster.concat(candidate).map((coord) => ([coord.latitude, coord.longitude]))); // is this right? long/lat i/o lat/lon
    // const polygon = hullOfPolygon.map<Coordinate>(i => ({ latitude: i[1], longitude: i[0] }));
    const polygon = sorted_points(hullOfPolygon.map(el => ({ x: el[0], y: el[1]}))).map<Coordinate>(i => ({ latitude: i.x, longitude: i.y }));
    //polygon.push(polygon[0]); // to close the loop in the polygon //  IS THIS NEEDED FOR THE ISPOINTINPOLYGON ray-trace algorithm?

    // assertion that we never flip the coordinates
    polygon.forEach(assertCoordinateIsInNLParameters);

    //optimize, only evaluate itmesOfOtherTypes where the coordinate is in the bounding box of the polygon
    const topLeftCoordOfPolygon = polygon.sort((a,b) => a.latitude < b.latitude && a.longitude < b.longitude ? 1 : -1)[0];
    const bottomRightCoordOfPolygon = polygon.sort((a,b) => a.latitude > b.latitude && a.longitude > b.longitude ? 1 : -1)[0];



    // determine if we can find any coordinates in the list of itemsOfOtherTypes which are in bounds of our polygon
    const polygonContainsCoordinateOfOtherType = itemsOfOtherTypes.some((otherItem) => {
        //const debugPointInPolygon = otherItem.title === "peer (Pyrus communis)" && [52.03147226092894, 52.03145316768199, 52.031527550646324].indexOf(otherItem.latitude) > -1;
        return isPointInPolygon(otherItem, polygon)
    });

    if(isDebugMode) {
        console.log(toWKT(polygon));
        console.log(`could grow polygon: ${!polygonContainsCoordinateOfOtherType}`)
    }
    return !polygonContainsCoordinateOfOtherType;
}

function clusterItems(remainingItems: GeoItem[], itemsOfOtherTypes: GeoItem[], maxDistanceBetweenTreesInMeters: number) : {remainingItems: GeoItem[], clusteredItems: GeoItem[]} {
    if(remainingItems.length === 0) {
        throw new Error('clustering can only be done with > 0 items to cluster');
    }
    const cluster = [remainingItems.pop()];

//  console.log(`Starting new cluster, starting at ${cluster[0].latitude} ${cluster[0].longitude}. RemainingItems.length=${remainingItems.length} (${cluster[0].title})`);

    let clusterOptionsAreExhausted = false;
    while (remainingItems.length > 0 && clusterOptionsAreExhausted === false) {
        
        // sort the remaining items on closestdistance to _any_ of our coordinates
        // but do respect a max distance to prevent very long stretched clusters from beeing formed
        let remainingItemsSortedClosestToOurCurrentClusterCoordinates = sortCandidatesOnShortestDistanceToCurrentCoordinatesOfCluster(cluster, remainingItems)
            .filter(itm => itm.closestDistanceToAnyOfOurCoordinates <= maxDistanceBetweenTreesInMeters);

        // if we do not have a polygon yet (size = 3) then we use the max distance calculation between trees
        // to prevent arbitrary datapoints from forming a cluster across the map
        // once we have a few datapoints set up we allow the polygon to grow to the size it can become
        // as long as it does not start to contain trees of other kinds
        // if (cluster.length <= 3) {
        //     remainingItemsSortedClosestToOurCurrentClusterCoordinates = remainingItemsSortedClosestToOurCurrentClusterCoordinates.filter(itm => itm.closestDistanceToAnyOfOurCoordinates <= maxDistanceBetweenTreesInMeters);
        // }

        // while we have not found a coordinate we can add:
        let succesfullyAddedCoordinateToCluster = false;
        while (remainingItemsSortedClosestToOurCurrentClusterCoordinates.length > 0 && !succesfullyAddedCoordinateToCluster) {
            succesfullyAddedCoordinateToCluster = false; // reset after each iteration

            // find the nearest coordinate to any of our coordinates in the current cluster) and try to add it
            // if no more candidates are available we have reached our max cluster size and shouldContinue=false
            const candidateToAdd = remainingItemsSortedClosestToOurCurrentClusterCoordinates.shift().item;
            if (growingToCoordinateCreatesPolygonWitoutOverlapWithCoordinatesOfOtherType(cluster, candidateToAdd, itemsOfOtherTypes)){
// console.log(` - found coordinate we can add without causing overlap with coordinates of other type: ${candidateToAdd.latitude} ${candidateToAdd.longitude} `);
                succesfullyAddedCoordinateToCluster = true;

                // its a match, we can add it to our cluster!
                cluster.push(candidateToAdd);

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
