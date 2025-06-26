# Bomenkaart voor bijen obv Den Haag

Maken van een bomenkaart met drachtbomen in directe nabijheid van Ypenburg

Combinatie van de bomenkaarten delft, den haag (nootdorp?) en de drachtplanten informatie van imkerpedia

## TODOs

- [] splitsen van de dracht informatie in meerdere lagen - lente / zomer / herfst zodat zichtbaar wordt wanneer er minder drachtaanbod beschikbaar is
- [] TODO clusteren bomen/shapes obv dichtbijheid van elkaar / grouperen shapes -> Vlakken van maken ? hoe dan? export in csv kan dat niet, KML?
- [x] Data fouten in denhaag vinden - welke bomen zijn er uitgefilterd obv typo's die er hadden moeten zijn?
- [] TODO - import in google maps is max 2000 datapunten per layer, max 10 layers totaal 10.000 datapunten -> clusteren?
  - specs KML layer om shapes te importeren? https://developers.google.com/maps/documentation/javascript/kmllayer?csw=1 

## Den Haag Bomen Data


https://denhaag.dataplatform.nl/#/data?autocomplete_field=(bomen)
https://denhaag.dataplatform.nl/#/data/77879f91-3d48-47dd-b33d-9e86ae5d99de

```
{
"type" : "FeatureCollection",
	"name" : "bomen",
	"crs" : {
		"type" : "name",
		"properties" : {
			"name" : "EPSG:28992"
		}
	},
	"features" : [
		{
			"type" : "Feature",
			"geometry" : {
				"type" : "Point",
				"coordinates" : [ 80080.418, 458531.333 ]
			},
```

### dmv jq filteren op enkel regio ypenburg

filteren van 
type.features
			based on gemoetry.coordinates [x, y]


jq '.features[]' bomen-json.json
jq '.features | map(select(.geometry.coordinates[0] >= 83395 and .geometry.coordinates[0] <= 87537 and .geometry.coordinates[1] >= 449244 and .geometry.coordinates[1] <= 452175))' bomen-json.json


converteren coordinaten -> https://benhup.com/tools/convert-coordinates/

topleft: 52.05325316920707, 4.3431938539781525
	RD => 83395 452175

bottom right: 52.02743574217603, 4.404156672597446
	RD => 87537 449244


`jq '.features | map(select(.geometry.coordinates[0] >= 83395 and .geometry.coordinates[0] <= 87537 and .geometry.coordinates[1] >= 449244 and .geometry.coordinates[1] <= 452175))' bomen-json.json > bomenkaart-ypenburg.json`

### filteren bomen obv waarde voor bijen

gebruik pollen tabel imkerpedia - https://www.imkerpedia.nl/wiki/index.php/Drachtplanten
yank table and put it into a csv

### opschonene bomen namen voor betere matching

*TODO*

bv "Tilia x europaea 'Euchlora'" fixxen

alles tussen '' weghalen
alles tussen () weghalen
training spaces weghalen
```
jq 'select(.) | map(.properties.BOOMSOORT_WETENSCHAPPELIJ |= gsub("\\([^)]*\\)"; ""))' bomenkaart-ypenburg.json \
    | jq "map(.properties.BOOMSOORT_WETENSCHAPPELIJ |= gsub(\"'[^']*'\"; \"\"))" \
    | jq 'map(.properties.BOOMSOORT_WETENSCHAPPELIJ |= gsub("^\\s+|\\s+$"; ""))' \
    > bomenkaart-cleanedup-ypenburg.json
```




### filteren bomen op basis van aanwezigheid in drachtplanten lijst

`jq --slurpfile ids drachtplanten-ids.json 'map(select(.properties.BOOMSOORT_WETENSCHAPPELIJ as $id | $ids[0] | index($id)))' bomenkaart-cleanedup-ypenburg.json > bomenkaart-ypenburg-filtered.json`

### converteren drachtplanten csv naar json

`csvjson drachtplanten-imkerpedia.csv | jq '.' > drachtplanten-imkerpedia.json` 


### toevoegen drachtinformatie aan bomenkaart ypenburg

```
jq --slurpfile enrichment drachtplanten-imkerpedia.json 'map(. as $item |
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
   )' bomenkaart-ypenburg-filtered.json > bomenkaart-ypenburg-filtered-enriched.json
```
### bomenlijst plat slaan om te importeren in google maps als csv


jq 'map({
  coordinateRD: "\(.geometry.coordinates[1]) \(.geometry.coordinates[0])",
  title: "\(.properties.BOOMSOORT_NEDERLANDS) (\(.properties.BOOMSOORT_WETENSCHAPPELIJ))",
  body: "Nectarwaarde: \(.properties.Nectarwaarde) , Pollenwaarde: \(.properties.Pollenwaarde), Bloeit van \(.properties.SB) t/m \(.properties.EB)",
})' bomenkaart-ypenburg-filtered-enriched.json > bomenkaart-ypenburg-prep4export-flattened.json


### cleanup: rijksdriehoek omzetten naar lat/lon coordinaten voor google maps

cp bomenkaart-ypenburg-prep4export-flattened.json ../RijksDriehoekConverter
cd ../RijksDriehoekConverter
ts-node index.ts > bomenkaart-ypenburg-prep4export-Wgs84-flattened.json
cp bomenkaart-ypenburg-prep4export-Wgs84-flattened.json ../source
cd ../source


## Delft Bomen Data

obv databron
- https://openbomenkaart.org/data/trees_delft.json
- filteren obv coordinaten die dichtbij genoeg zijn

links onder coordinaat = 52.02691, 4.34384 & rechts boven coordinaat = 52.05377, 4.40361

`jq '.elements | map(select(.lat >= 52.02691 and .lat <= 52.05377 and .lon >= 4.34384 and .lon <= 4.40361))' trees_delft.json > filtered-local-trees-delft.json`

### convert naming of trees that mismatch the drachtplanten list

// remove everything between ''
// remove everythign between ()
// remove any trailing spaces
Aesculus carnea => Aesculus x carnea
Tilia europaea 'Zwarte Linde' => Tilia x europaea


```
jq 'select(.) | map(.tags.species |= gsub("\\([^)]*\\)"; ""))' filtered-local-trees-delft.json \
    | jq "map(.tags.species |= gsub(\"'[^']*'\"; \"\"))" \
    | jq 'map(.tags.species |= gsub("^\\s+|\\s+$"; ""))' \
    | jq 'map(if .tags.species == "Aesculus carnea" then .tags.species = "Aesculus x carnea" else . end)' \
    | jq 'map(if .tags.species == "Tilia europaea" then .tags.species = "Tilia x europaea" else . end)' \
    > filtered-cleanup-local-trees-delft.json
```

### remove all non-drachtplanten from the list

`jq --slurpfile ids drachtplanten-ids.json 'map(select(.tags.species as $id | $ids[0] | index($id)))' filtered-cleanup-local-trees-delft.json > filtered-only-drachtplanten-local-trees-delft.json`

### enrich pollen information

jq --slurpfile enrichment drachtplanten-imkerpedia.json 'map(. as $item |
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
   )' filtered-only-drachtplanten-local-trees-delft.json > filtered-only-drachtplanten-local-trees-delft-enriched.json

### map trees to format that we need

jq 'map({ 
    latitude: .lat, 
    longitude: .lon, 
    title: "\(.tags.BOOMSOORT_NEDERLANDS) (\(.tags.species))",
    body: "Nectarwaarde: \(.tags.Nectarwaarde), Pollenwaarde: \(.tags.Pollenwaarde), Bloeit van \(.tags.SB) t/m \(.tags.EB)" 
    })' filtered-only-drachtplanten-local-trees-delft-enriched.json > output-delft-trees-formatted.json


## MERGE DEN HAAG + DELFT 

After converting rijkds driehoek also to lat lon using typescript

jq -s 'add' output-delft-trees-formatted.json bomenkaart-ypenburg-prep4export-Wgs84-flattened.json > merged-output-delft-denhaag.json


## convert to CSV output and import into google maps
`jq -r '(.[0] | keys_unsorted) as $keys | $keys, map([.[ $keys[] ]])[] | @csv' merged-output-delft-denhaag.json > merged-output-delft-denhaag.csv`

import the CSV with markers into google maps -> https://www.google.com/maps/d/u/0/edit?hl=en&mid=1rEXjvP8rAoK41iPF5tkkcRLcWMVaP8c&ll=52.03850518347734%2C4.366191369035044&z=15

and... profit!

![profit](experimental-result.png)


## credits

rijksdriehoek to wgs84 script copied from https://gist.github.com/erikvullings/a2c58cecc3f0a27b043deba90089af57
