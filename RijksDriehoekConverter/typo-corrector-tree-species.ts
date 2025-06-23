import Fuse from 'fuse.js';
import * as fs from 'fs';
import * as path from 'path';

// Get the filename from command-line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Please provide a JSON filename as an argument.');
  process.exit(1);
}

const filename = args[0];

// Resolve the full path and read the file
try {
  const filePath = path.resolve(filename);
  const rawData = fs.readFileSync(filePath, 'utf-8');
  const titles: string[] = JSON.parse(rawData);

  console.log('Loaded titles:', titles);
} catch (error) {
  console.error('Error reading or parsing the file:', error.message);
}

// Set up Fuse.js for fuzzy matching
const fuse = new Fuse(titles, {
includeScore: true,
    threshold: 0.4 // Lower is stricter; adjust as needed
});


// Function to correct titles
function correctTitles(titles: string[]): string[] {
    return titles.map(title => {
        const result = fuse.search(title);
        return result.length > 0 ? result[0].item : title;
    });
}

// Run correction
// TODO - load the list to be corrected
// const corrected = correctTitles(typoTitles);
// console.log(corrected);
