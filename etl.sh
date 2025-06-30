
#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -euo pipefail
# for debugging; show the commands before they are executed
# set -x 

rm tmp/*.json

echo "Converting tree information from The Hague to zoom in on Ypenburg and only render trees relevant for honeybees..."

# extract only ypenburg area
jq '.features | map(select(.geometry.coordinates[0] >= 83395 and .geometry.coordinates[0] <= 87537 and .geometry.coordinates[1] >= 449244 and .geometry.coordinates[1] <= 452175))' source/bomen-json.json > tmp/bomenkaart-ypenburg.json
# clean up data names
# // remove everything between ''
# // remove everythign between ()
# // remove any trailing spaces

jq 'select(.) | map(.properties.BOOMSOORT_WETENSCHAPPELIJ |= gsub("\\([^)]*\\)"; ""))' tmp/bomenkaart-ypenburg.json \
    | jq "map(.properties.BOOMSOORT_WETENSCHAPPELIJ |= gsub(\"'[^']*'\"; \"\"))" \
    | jq 'map(.properties.BOOMSOORT_WETENSCHAPPELIJ |= gsub("^\\s+|\\s+$"; ""))' \
    > tmp/bomenkaart-cleanedup-ypenburg.json
# filter only trees that are in the list of plants relevant for honeybees
jq --slurpfile ids source/drachtplanten-ids.json 'map(select(.properties.BOOMSOORT_WETENSCHAPPELIJ as $id | $ids[0] | index($id)))' tmp/bomenkaart-cleanedup-ypenburg.json > tmp/bomenkaart-ypenburg-filtered.json

# append honeybee tree info to the output
jq --slurpfile enrichment source/drachtplanten-imkerpedia.json 'map(. as $item |
       ($enrichment[0][] | select(.["Latijnse naam"] == $item.properties.BOOMSOORT_WETENSCHAPPELIJ)) as $match |
       if $match then
           $item + {
               properties: ($item.properties + {
                   Nectarwaarde: $match.Nectarwaarde,
                   Pollenwaarde: $match.Pollenwaarde,
                   SB: $match.SB,
                   EB: $match.EB
               })
           }
       else
           $item
       end
   )' tmp/bomenkaart-ypenburg-filtered.json > tmp/bomenkaart-ypenburg-filtered-enriched.json

# transform the list to the output format we need for google maps
jq 'map({
  coordinateRD: "\(.geometry.coordinates[1]) \(.geometry.coordinates[0])",
  Pollenwaarde: .properties.Pollenwaarde,
  Nectarwaarde: .properties.Nectarwaarde,
  title: "\(.properties.BOOMSOORT_NEDERLANDS) (\(.properties.BOOMSOORT_WETENSCHAPPELIJ))",
  body: "Nectarwaarde: \(.properties.Nectarwaarde) , Pollenwaarde: \(.properties.Pollenwaarde), Bloeit van \(.properties.SB) t/m \(.properties.EB)",
})' tmp/bomenkaart-ypenburg-filtered-enriched.json > tmp/bomenkaart-ypenburg-prep4export-flattened.json

# convert rijksdriehoek to lat/long
cp tmp/bomenkaart-ypenburg-prep4export-flattened.json RijksDriehoekConverter
cd RijksDriehoekConverter
ts-node index.ts > ../tmp/bomenkaart-ypenburg-prep4export-Wgs84-flattened.json
#cp bomenkaart-ypenburg-prep4export-Wgs84-flattened.json ../source
cd ..



echo "Converting tree information from Delft to zoom in on Ypenburg and only render trees relevant for honeybees..."
# filter only trees in ypenburg area
jq '.elements | map(select(.lat >= 52.02691 and .lat <= 52.05377 and .lon >= 4.34384 and .lon <= 4.40361))' source/trees_delft.json > tmp/filtered-local-trees-delft.json

# cleanup tree names
# // remove everything between ''
# // remove everythign between ()
# // remove any trailing spaces
# Aesculus carnea => Aesculus x carnea
# Tilia europaea 'Zwarte Linde' => Tilia x europaea

jq 'select(.) | map(.tags.species |= gsub("\\([^)]*\\)"; ""))' tmp/filtered-local-trees-delft.json \
    | jq "map(.tags.species |= gsub(\"'[^']*'\"; \"\"))" \
    | jq 'map(.tags.species |= gsub("^\\s+|\\s+$"; ""))' \
    | jq 'map(if .tags.species == "Aesculus carnea" then .tags.species = "Aesculus x carnea" else . end)' \
    | jq 'map(if .tags.species == "Tilia europaea" then .tags.species = "Tilia x europaea" else . end)' \
    > tmp/filtered-cleanup-local-trees-delft.json

# remove all trees not relevant to honeybees based on existance in drachtplanten-ids list
jq --slurpfile ids source/drachtplanten-ids.json 'map(select(.tags.species as $id | $ids[0] | index($id)))' tmp/filtered-cleanup-local-trees-delft.json > tmp/filtered-only-drachtplanten-local-trees-delft.json

# enrich pollen information to trees
jq --slurpfile enrichment source/drachtplanten-imkerpedia.json 'map(. as $item |
       ($enrichment[0][] | select(.["Latijnse naam"] == $item.tags.species)) as $match |
       if $match then
           $item + {
               tags: ($item.tags + {
                   Nectarwaarde: $match.Nectarwaarde,
                   Pollenwaarde: $match.Pollenwaarde,
                   SB: $match.SB,
                   EB: $match.EB,
                   BOOMSOORT_NEDERLANDS: $match."Nederlandse naam"
               })
           }
       else
           $item
       end
   )' tmp/filtered-only-drachtplanten-local-trees-delft.json > tmp/filtered-only-drachtplanten-local-trees-delft-enriched.json

# convert format to the output format we need
jq 'map({ 
    latitude: .lat, 
    longitude: .lon,
    Pollenwaarde: .tags.Pollenwaarde,
    Nectarwaarde: .tags.Nectarwaarde,
    title: "\(.tags.BOOMSOORT_NEDERLANDS) (\(.tags.species))",
    body: "Nectarwaarde: \(.tags.Nectarwaarde), Pollenwaarde: \(.tags.Pollenwaarde), Bloeit van \(.tags.SB) t/m \(.tags.EB)" 
    })' tmp/filtered-only-drachtplanten-local-trees-delft-enriched.json > tmp/output-delft-trees-formatted.json

echo "Merging data into one master dataset for trees in Ypenburg..."

jq -s 'add' tmp/output-delft-trees-formatted.json tmp/bomenkaart-ypenburg-prep4export-Wgs84-flattened.json > tmp/merged-output-delft-denhaag.json

# only keep trees where the nectar or pollen value is greater then 3
jq 'map(select(((.Nectarwaarde | tonumber? // 0) > 3) or ((.Pollenwaarde | tonumber? // 0) > 3) ))' tmp/merged-output-delft-denhaag.json > tmp/merged-output-delft-denhaag-filtered-pollen.json

# final cleanup to remove columns we no longer need
jq 'map({
    latitude: .latitude, 
    longitude: .longitude,
    Pollenwaarde: .Pollenwaarde,
    Nectarwaarde: .Nectarwaarde,
    title: .title,
    body: .body
})' tmp/merged-output-delft-denhaag-filtered-pollen.json > tmp/merged-output-delft-denhaag-filtered-pollen-cleaned-up.json

#
# OUTPUT TO FINAL FILES // CHUNKING
#


jq -r '(.[0] | keys_unsorted) as $keys | $keys, map([.[ $keys[] ]])[] | @csv' tmp/merged-output-delft-denhaag-filtered-pollen-cleaned-up.json > output/merged-output-delft-denhaag.csv
echo "The masterlist is done! -> output/merged-output-delft-denhaag.csv"

## splitting in max 2000 items because google maps limitations (as test)

INPUT_FILE="tmp/merged-output-delft-denhaag-filtered-pollen-cleaned-up.json"
OUTPUT_PREFIX="tmp/merged-output-delft-denhaag_chunk"
OUTPUT_CSV_PREFIX="output/merged-output-delft-denhaag_chunk"
CHUNK_SIZE=2000

# Get the total number of items in the array
TOTAL_ITEMS=$(jq 'length' "$INPUT_FILE")

# Calculate the number of chunks
NUM_CHUNKS=$(( (TOTAL_ITEMS + CHUNK_SIZE - 1) / CHUNK_SIZE ))

echo "Splitting $TOTAL_ITEMS items into $NUM_CHUNKS chunks..."

# Loop through and split
for ((i=0; i<NUM_CHUNKS; i++)); do
    START=$((i * CHUNK_SIZE))
    END=$((START + CHUNK_SIZE - 1))
    jq ".[$START:$((START + CHUNK_SIZE))]" "$INPUT_FILE" > "${OUTPUT_PREFIX}_${i}.json"
    jq -r '(.[0] | keys_unsorted) as $keys | $keys, map([.[ $keys[] ]])[] | @csv' "${OUTPUT_PREFIX}_${i}.json" > "${OUTPUT_CSV_PREFIX}_${i}.csv"
    echo "Created ${OUTPUT_PREFIX}_${i}.json with items $START to $END"
done

echo "Done."
