
#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -euo pipefail
# for debugging; show the commands before they are executed
# set -x 

rm -f tmp/*.json
rm -f output/*.csv


echo "Converting tree information from Pijnacker-Nootdorp dataset to zoom in on Ypenburg and only render trees relevant for honeybees..."

# only take the ypenburg area

jq '. | map(select(.X >= 83395 and .X <= 87537 and .Y >= 449244 and .Y <= 452175))' source/Bomenbestand-Nootdorp-20250701.json > tmp/Bomenbestand-Nootdorp_YpenburgArea.json

# clean up data names
# skip all trees which have no Soortnaam
# // remove everything between ''
# // remove everythign between ()
# // remove any trailing spaces
# // remove any remaining '
# Typo -> Acer cappadocium -> Acer cappadocicum 
# Typo -> Acer cappadorcicum -> Acer cappadocicum 
# Typo -> Acer platanoides s Black -> Acer platanoides
# Typo -> Malus domestica s Orange Pippin' -> Malus domestica
# Typo -> Sorbus thuringiaca -> Sorbus x thuringiaca
# Typo -> Tilia europaea -> Tilia x europaea
jq '[.[] | select(.Soortnaam and (.Soortnaam | test("\\S")))]' tmp/Bomenbestand-Nootdorp_YpenburgArea.json \
    | jq 'select(.) | map(.Soortnaam |= gsub("\\([^)]*\\)"; ""))' \
    | jq "map(.Soortnaam |= gsub(\"'[^']*'\"; \"\"))" \
    | jq 'map(.Soortnaam |= gsub("^\\s+|\\s+$"; ""))' \
    | jq "map(.Soortnaam |= gsub(\"'\"; \"\"))" \
    | jq 'map(if .Soortnaam == "Acer cappadocium" then .Soortnaam = "Acer cappadocicum" else . end)' \
    | jq 'map(if .Soortnaam == "Acer cappadorcicum" then .Soortnaam = "Acer cappadocicum" else . end)' \
    | jq 'map(if .Soortnaam == "Acer platanoides s Black" then .Soortnaam = "Acer platanoides" else . end)' \
    | jq 'map(if .Soortnaam == "Malus domestica s Orange Pippin" then .Soortnaam = "Malus domestica" else . end)' \
    | jq 'map(if .Soortnaam == "Sorbus thuringiaca" then .Soortnaam = "Sorbus x thuringiaca" else . end)' \
    | jq 'map(if .Soortnaam == "Tilia europaea" then .Soortnaam = "Tilia x europaea" else . end)' \
    > tmp/Bomenbestand-Nootdorp_YpenburgArea_CleanedUpNames.json

# filter only trees that are in the list of plants relevant for honeybees
# TODO - match based on tolowercase => jq ascii_downcase
jq --slurpfile ids source/drachtplanten-ids.json 'map(select(.Soortnaam as $id | $ids[0] | index($id)))' tmp/Bomenbestand-Nootdorp_YpenburgArea_CleanedUpNames.json > tmp/Bomenbestand-Nootdorp_YpenburgArea_CleanedUpNamesFiltered.json

# append honeybee tree info to the output
jq --slurpfile enrichment source/drachtplanten-imkerpedia.json 'map(. as $item |
       ($enrichment[0][] | select(.["Latijnse naam"] == $item.Soortnaam)) as $match |
       if $match then
           $item + {
                Nectarwaarde: $match.Nectarwaarde,
                Pollenwaarde: $match.Pollenwaarde,
                SB: $match.SB,
                EB: $match.EB
           }
       else
           $item
       end
   )' tmp/Bomenbestand-Nootdorp_YpenburgArea_CleanedUpNamesFiltered.json > tmp/Bomenbestand-Nootdorp_YpenburgArea_CleanedUpNamesFilteredEnriched.json

jq 'map({
  coordinateRD: "\(.X) \(.Y)",
  Pollenwaarde: .Pollenwaarde,
  Nectarwaarde: .Nectarwaarde,
  Startbloei: .SB,
  Eindebloei: .EB,
  title: "\(.["Soortnaam Nederlands"]) (\(.Soortnaam))",
  body: "Nectarwaarde: \(.Nectarwaarde) , Pollenwaarde: \(.Pollenwaarde), Bloeit van \(.SB) t/m \(.EB)",
})' tmp/Bomenbestand-Nootdorp_YpenburgArea_CleanedUpNamesFilteredEnriched.json > tmp/Bomenbestand-Nootdorp_YpenburgArea_CleanedUpNamesFilteredEnriched_Prep4Export.json

#convert Rijksdriehoek to GPS lat/lon
ts-node RijksDriehoekConverter/index.ts tmp/Bomenbestand-Nootdorp_YpenburgArea_CleanedUpNamesFilteredEnriched_Prep4Export.json > tmp/Bomenbestand-Nootdorp_YpenburgArea_CleanedUpNamesFilteredEnriched_RDS2LatLon.json

echo "Converting tree information from The Hague dataset to zoom in on Ypenburg and only render trees relevant for honeybees..."

# extract only ypenburg area
jq '.features | map(select(.geometry.coordinates[0] >= 83395 and .geometry.coordinates[0] <= 87537 and .geometry.coordinates[1] >= 449244 and .geometry.coordinates[1] <= 452175))' source/bomen-json.json > tmp/bomenkaart-ypenburg.json
# clean up data names
# // remove everything between ''
# // remove everythign between ()
# // remove any trailing spaces
# finally rename
# Acer capillipes x davidii -> Acer capillipes
# Acer cappadocium subsp. -> Acer cappadocicum
# Acer pseudoplatatnus -> Acer pseudoplatanus
# Acer rubrum INDIAN SUMMER -> Acer rubrum
# Acer tataricum  subsp. ginnala -> Acer tataricum  subsp.ginnala
# Robinia hispida -> Robinia hispida (incl. ssp. fertilis)
jq 'select(.) | map(.properties.BOOMSOORT_WETENSCHAPPELIJ |= gsub("\\([^)]*\\)"; ""))' tmp/bomenkaart-ypenburg.json \
    | jq "map(.properties.BOOMSOORT_WETENSCHAPPELIJ |= gsub(\"'[^']*'\"; \"\"))" \
    | jq 'map(.properties.BOOMSOORT_WETENSCHAPPELIJ |= gsub("^\\s+|\\s+$"; ""))' \
    | jq 'map(if .Soortnaam == "Acer capillipes x davidii" then .Soortnaam = "Acer capillipes" else . end)' \
    | jq 'map(if .Soortnaam == "Acer cappadocium subsp." then .Soortnaam = "Acer cappadocicum" else . end)' \
    | jq 'map(if .Soortnaam == "Acer pseudoplatatnus" then .Soortnaam = "Acer pseudoplatanus" else . end)' \
    | jq 'map(if .Soortnaam == "Acer rubrum INDIAN SUMMER" then .Soortnaam = "Acer rubrum" else . end)' \
    | jq 'map(if .Soortnaam == "Acer tataricum  subsp. ginnala" then .Soortnaam = "Acer tataricum  subsp.ginnala" else . end)' \
    | jq 'map(if .Soortnaam == "Robinia hispida" then .Soortnaam = "Robinia hispida (incl. ssp. fertilis)" else . end)' \
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
  coordinateRD: "\(.geometry.coordinates[0]) \(.geometry.coordinates[1])",
  Startbloei: .properties.SB,
  Eindebloei: .properties.EB,
  Pollenwaarde: .properties.Pollenwaarde,
  Nectarwaarde: .properties.Nectarwaarde,
  title: "\(.properties.BOOMSOORT_NEDERLANDS) (\(.properties.BOOMSOORT_WETENSCHAPPELIJ))",
  body: "Nectarwaarde: \(.properties.Nectarwaarde) , Pollenwaarde: \(.properties.Pollenwaarde), Bloeit van \(.properties.SB) t/m \(.properties.EB)",
})' tmp/bomenkaart-ypenburg-filtered-enriched.json > tmp/bomenkaart-ypenburg-prep4export-flattened.json

# convert rijksdriehoek to lat/long
ts-node RijksDriehoekConverter/index.ts tmp/bomenkaart-ypenburg-prep4export-flattened.json > tmp/bomenkaart-ypenburg_CleanedUpNamesFilteredEnriched_RDS2LatLon.json



echo "Converting tree information from Delft dataset to zoom in on Ypenburg and only render trees relevant for honeybees..."
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
    Startbloei: .tags.SB,
    Eindebloei: .tags.EB,
    title: "\(.tags.BOOMSOORT_NEDERLANDS) (\(.tags.species))",
    body: "Nectarwaarde: \(.tags.Nectarwaarde), Pollenwaarde: \(.tags.Pollenwaarde), Bloeit van \(.tags.SB) t/m \(.tags.EB)" 
    })' tmp/filtered-only-drachtplanten-local-trees-delft-enriched.json > tmp/output-delft-trees-formatted.json

#
# MERGE ALL THE DATASETS
#


echo "Merging data into one master dataset for trees in Ypenburg..."

jq -s 'add' tmp/output-delft-trees-formatted.json tmp/bomenkaart-ypenburg_CleanedUpNamesFilteredEnriched_RDS2LatLon.json tmp/Bomenbestand-Nootdorp_YpenburgArea_CleanedUpNamesFilteredEnriched_RDS2LatLon.json > tmp/merged-output.json

# only keep trees where the nectar or pollen value is greater then 3
jq 'map(select(((.Nectarwaarde | tonumber? // 0) > 3) or ((.Pollenwaarde | tonumber? // 0) > 3) ))' tmp/merged-output.json > tmp/merged-output-filtered-pollen.json

# final cleanup to remove columns we no longer need
jq 'map({
    latitude: .latitude, 
    longitude: .longitude,
    Pollenwaarde: .Pollenwaarde,
    Nectarwaarde: .Nectarwaarde,
    StartBloei: .Startbloei,
    EindeBloei: .Eindebloei,
    title: .title,
    body: .body
})' tmp/merged-output-filtered-pollen.json > tmp/merged-output-filtered-pollenindex-cleanedup-formatted.json

# split the total tree list into separate once per month: 3/4/5/6/7/8/9 to see if that results in relevancy
# echo "Going to split the masterlist of trees into blossoming trees per month"
for i in {4..9}
do
    echo "splitting master list of trees... selecting trees that blossom in month #$i..."
    jq "[.[] | select((.StartBloei | tonumber?) <= $i and (.EindeBloei | tonumber?) >= $i)]" tmp/merged-output-filtered-pollenindex-cleanedup-formatted.json > tmp/mergedresult-trees-blossoming_month_$i.json
    
    echo "clustering trees..."
    # cluster trees into shapes / WKT format
    NODE_OPTIONS='--max-semi-space-size=128 --max-old-space-size=8096' ts-node TreeCoordinateClusterer/index.ts tmp/mergedresult-trees-blossoming_month_$i.json > tmp/mergedresult-trees-clustered-blossoming_month_$i.json
    jq -r '(.[0] | keys_unsorted) as $keys | $keys, map([.[ $keys[] ]])[] | @csv' tmp/mergedresult-trees-clustered-blossoming_month_$i.json > output/mergedresult-trees-clustered-blossoming_month_$i.csv
    echo "converting to csv"
done

#
# OUTPUT TO FINAL FILES when we do an ALL in ONE
#
# jq -r '(.[0] | keys_unsorted) as $keys | $keys, map([.[ $keys[] ]])[] | @csv' tmp/merged-output-filtered-pollenindex-cleanedup-formatted.json > output/merged-output-filtered-pollenindex-cleanedup-formatted.csv
# echo "The masterlist is done! -> output/merged-output-filtered-pollenindex-cleanedup-formatted.csv"

## splitting in max 2000 items because google maps limitations (as test)

# INPUT_FILE="tmp/merged-output-filtered-pollenindex-cleanedup-formatted.json"
# OUTPUT_PREFIX="tmp/merged-output-delft-denhaag_chunk"
# OUTPUT_CSV_PREFIX="output/merged-output-delft-denhaag_chunk"
# CHUNK_SIZE=2000

# # Get the total number of items in the array
# TOTAL_ITEMS=$(jq 'length' "$INPUT_FILE")

# # Calculate the number of chunks
# NUM_CHUNKS=$(( (TOTAL_ITEMS + CHUNK_SIZE - 1) / CHUNK_SIZE ))

# echo "Splitting $TOTAL_ITEMS items into $NUM_CHUNKS chunks..."

# # Loop through and split
# for ((i=0; i<NUM_CHUNKS; i++)); do
#     START=$((i * CHUNK_SIZE))
#     END=$((START + CHUNK_SIZE - 1))
#     jq ".[$START:$((START + CHUNK_SIZE))]" "$INPUT_FILE" > "${OUTPUT_PREFIX}_${i}.json"
#     jq -r '(.[0] | keys_unsorted) as $keys | $keys, map([.[ $keys[] ]])[] | @csv' "${OUTPUT_PREFIX}_${i}.json" > "${OUTPUT_CSV_PREFIX}_${i}.csv"
#     echo "Created ${OUTPUT_PREFIX}_${i}.json with items $START to $END"
# done

echo "Done."
