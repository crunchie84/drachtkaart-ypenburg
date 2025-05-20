import { readFileSync } from 'fs';
import * as geo from './geo'

const input = readFileSync('./bomenkaart-ypenburg-prep4export-flattened.json', 'utf-8');
const inputParsed = JSON.parse(input);

const result = inputParsed.map((item: any) => {

    const RDa = parseInt(item.coordinateRD.split(' ')[0],10)
    const RDb = parseInt(item.coordinateRD.split(' ')[1],10)

    const coordinates = geo.projectRdWgs84.rdToWgs84(RDb, RDa)

    return {
        latitude: coordinates.lat,
        longitude: coordinates.lon,
        //coordinates: geo.projectRdWgs84.rdToWgs84(RDa, RDb),
        ...item,
    }
});


console.log(JSON.stringify(result, null, '  '));