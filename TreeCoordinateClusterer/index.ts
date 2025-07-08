import * as fs from 'fs';
import * as path from 'path';
import * as process from 'process';

import { getDistance, isPointInPolygon } from 'geolib';

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

const debugging = false;
if(debugging) {
    const debugPolygon = ["52.0273267472761 4.37307969465699","52.0273061947089 4.37287882148708","52.0271903852604 4.37293747232614","52.0270104347336 4.37377949240016","52.0277038217237 4.37380001552899","52.028653604916 4.37428690877909","52.0281714506803 4.37327306014986","52.0281265361635 4.37317207242521"]
    const treesInPolygon = ["52.0274250925171 4.37351597825935","52.027386847326 4.3733376686683"]
    function debugOutput(polygonPointsToCheck: Array<string>, coordinatesWhichShouldNotBeInPolygon: Array<string>) {

        const debugPolygon = polygonPointsToCheck.map<GeoItem>(i => toGeoItem(i, 'WrongPolygonTreeType'));
        const treesInPolygon = coordinatesWhichShouldNotBeInPolygon.map<GeoItem>(i => toGeoItem(i, 'OtherTreeType'));

        const result = groupTreesByKindAndCluster(debugPolygon.concat(treesInPolygon), maxDistanceToOtherTreesInMeters);
        console.log('FINAL WKT OUTPUT: ');
        console.log(`GEOMETRYCOLLECTION (${toOutputObjectArray(result).map(i => i.WKT).join(', ')})`);
    }
    debugOutput(debugPolygon, treesInPolygon);
}
else {

    // const polygon = ["52.0316732790945 4.378476003826965","52.029343030347384 4.378222454849103","52.029601254156375 4.381087435514089","52.03082445790613 4.388565036426451","52.0308701343517 4.3886514559337435","52.033950270209736 4.391483007952142","52.03403127644325 4.39149578111398","52.03467550591685 4.391146252705188","52.03480895489424 4.390982968259946","52.0347933288733 4.387019121297067","52.034567171441275 4.381573428250642","52.033908537762684 4.379183510341133","52.03318708460872 4.378908271788824"]
    //     .map(i => toGeoItem(i, 'schietwilg (Salix alba)'));
    // const tocheck = toGeoItem("52.03147226092894 4.382298703941558", 'peer (Pyrus communis)');

    // const insidePolygon = isPointInPolygon(tocheck,polygon);
    // if(!insidePolygon) throw new Error('should be inside polygon!');
    // console.log('done');


    // // we only want to debug the trees which currently are comprised in one polygon which is wrong
    // const coordinatesToTest = ["52.03083944055885 4.3818757113916185","52.03080287055943 4.381803667340746","52.03020683674369 4.382531110498444","52.03015192015624 4.382415760201607","52.029601254156375 4.381087435514089","52.0302704207987 4.380504067004907","52.03028889305777 4.380561943049007","52.030334824473144 4.380677493346504","52.03023347619542 4.380388315060349","52.030178059077635 4.38021468750262","52.030122766337996 4.380055630315562","52.03007670966605 4.379925511281153","52.029581310352384 4.378756272885603","52.02963635529254 4.37888618698356","52.02951727829035 4.378626561448593","52.02948033184595 4.378510813007402","52.029389213738575 4.378367139688224","52.029343030347384 4.378222454849103","52.02971873530324 4.379059204022942","52.02980136452528 4.379261361364004","52.02984729721383 4.3793769090647325","52.02992980119935 4.3795644976989685","52.02996649724895 4.37965110840022","52.03146561080709 4.385738121543942","52.03152913938273 4.385809567151308","52.031566078668554 4.385925326944944","52.031804199995854 4.386444642102223","52.03178721669812 4.386561607708805","52.03052821655546 4.383325410233198","52.03245638316986 4.388091448454075","52.03248420959493 4.388192842235141","52.03255660006075 4.388249521763273","52.032548725576795 4.388380859018844","52.03335551154299 4.390242885174283","52.03385892140955 4.391310151465663","52.0339045958413 4.391396579620701","52.033950270209736 4.391483007952142","52.03403127644325 4.39149578111398","52.03411142010041 4.3914065553707475","52.03431627243977 4.39118338968846","52.034369578122906 4.391109333781458","52.03467550591685 4.391146252705188","52.03480895489424 4.390982968259946","52.03083270339184 4.388477414863136","52.03082445790613 4.388565036426451","52.0308701343517 4.3886514559337435","52.0316732790945 4.378476003826965","52.032732990218626 4.379413995970452","52.032863795029556 4.379993998307097","52.03318708460872 4.378908271788824","52.033908537762684 4.379183510341133","52.03287737035627 4.381582219464612","52.034175476972514 4.3820194443750715","52.03422003868535 4.3819747220961025","52.03426460038066 4.381929999727948","52.034389173960484 4.381781462488191","52.03444259813031 4.38172196666103","52.0344870352904 4.3816626724528565","52.03453159686388 4.3816179495065715","52.034567171441275 4.381573428250642","52.03344496811247 4.383842991661469","52.03348178517662 4.383944183714439","52.03353670026591 4.3840595444441375","52.033591615242436 4.384174905457054","52.033655889418576 4.384333778837655","52.03371105230725 4.3844782827406785","52.033765966874505 4.384593644717487","52.033811770281716 4.384694636966717","52.03385769765074 4.38481020059475","52.03389451388573 4.3849113943787446","52.033850199101714 4.384985255756168","52.03395853903651 4.385041127483179","52.03399535507353 4.385142321685652","52.034041282004246 4.385257886248219","52.03410530677418 4.385387620274331","52.03424308650642 4.385734316282899","52.03427977802748 4.3858209403876165","52.03432558038457 4.38592193505431","52.03438061743578 4.386051871735335","52.03442641959526 4.386152866866259","52.034481580256944 4.386297375504842","52.03451827136478 4.386384000533662","52.03457330790734 4.386513938343461","52.034628344306846 4.3866438764731415","52.03467426976744 4.3867594442145705","52.03472930589669 4.386889382939891","52.0347933288733 4.387019121297067"]
    // const toFilter = coordinatesToTest.map<GeoItem>(i => toGeoItem(i, 'schietwilg (Salix alba)'));
    // const data2 = data.filter(i => i.title != 'schietwilg (Salix alba)' || toFilter.some(f => f.latitude === i.latitude && f.longitude === i.longitude));
    // const result = groupTreesByKindAndCluster(data, maxDistanceToOtherTreesInMeters);
    // console.log('FINAL WKT OUTPUT: ');
    // console.log(`GEOMETRYCOLLECTION (${toOutputObjectArray(result).map(i => i.WKT).join(', ')})`);

    // // FINAL VERSION HERE:
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

function groupTreesByKindAndCluster(items: GeoItem[], maxDistanceToOtherTreesInMeters: number): Array<{ treeKind: GeoItem, clusters: GeoItem[][]}> {
    // group all GeoItems based on SoortNaam
    const groupedData = groupBy(items, (i => i.title));

    const result = groupedData
//.filter(group => group.key === "schietwilg (Salix alba)")
    .map((groupedTrees) => {
        const soort = groupedTrees.key;
        const clustersOfTreeKind = clusterTreesWithoutOverlappingOtherClusters(groupedTrees.items, items, maxDistanceToOtherTreesInMeters);

        return {
            treeKind: items.find(i => i.title === soort) || {} as GeoItem, // cheats to fix the nullref typescript assumption
            clusters: clustersOfTreeKind
        }
    });

    return result;
}

