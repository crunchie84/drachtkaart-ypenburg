import { readFileSync } from 'fs';
import * as process from 'process';
import { resolve } from 'path';
import { rds, rd2WGS84 } from './rds/rd2wgs84';

const args = process.argv.slice(2);

if (args.length === 0) {
    console.error('Please provide a path to a JSON file.');
    process.exit(1);
}

const filePath = resolve(args[0]);
const input = readFileSync(filePath, 'utf-8');
const inputParsed = JSON.parse(input);

const result = inputParsed.map((item: any) => {

    const rds: rds = {
        x: parseInt(item.coordinateRD.split(' ')[0],10),
        y: parseInt(item.coordinateRD.split(' ')[1],10)
    };

    const coordinates = rd2WGS84(rds);

    return {
        latitude: coordinates.lat,
        longitude: coordinates.lon,
        ...item,
    }
});


console.log(JSON.stringify(result, null, '  '));