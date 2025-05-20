# Bomenkaart voor bijen obv Den Haag

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

## dmv jq filteren op enkel regio ypenburg

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

## filteren bomen obv waarde voor bijen

gebruik pollen tabel imkerpedia - https://www.imkerpedia.nl/wiki/index.php/Drachtplanten
yank table and put it into a csv

## filteren bomen op basis van aanwezigheid in drachtplanten lijst


`jq --slurpfile ids drachtplanten-ids.json 'map(select(.properties.BOOMSOORT_WETENSCHAPPELIJ as $id | $ids[0] | index($id)))' bomenkaart-ypenburg.json > bomenkaart-ypenburg-filtered.json`

## converteren drachtplanten csv naar json

`csvjson drachtplanten-imkerpedia.csv | jq '.' > drachtplanten-imkerpedia.jso` 


## toevoegen drachtinformatie aan bomenkaart ypenburg

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
## bomenlijst plat slaan om te importeren in google maps als csv


jq 'map({
  coordinateRD: "\(.geometry.coordinates[1]) \(.geometry.coordinates[0])",
  title: "\(.properties.BOOMSOORT_NEDERLANDS) (\(.properties.BOOMSOORT_WETENSCHAPPELIJ))",
  body: "Nectarwaarde: \(.properties.Nectarwaarde) , Pollenwaarde: \(.properties.Pollenwaarde), Bloeit van \(.properties.SB) t/m \(.properties.EB)",
})' bomenkaart-ypenburg-filtered-enriched.json > bomenkaart-ypenburg-prep4export-flattened.json


## rijksdriehoek omzetten naar lat/lon coordinaten voor google maps

cp bomenkaart-ypenburg-prep4export-flattened.json ../RijksDriehoekConverter
cd ../RijksDriehoekConverter
ts-node index.ts > bomenkaart-ypenburg-prep4export-Wgs84-flattened.json


jq -r '(.[0] | keys_unsorted) as $keys | $keys, map([.[ $keys[] ]])[] | @csv' bomenkaart-ypenburg-prep4export-Wgs84-flattened.json > bomenkaart-ypenburg-prep4export-Wgs84-flattened.csv




## clusteren bomen/shapes obv dichtbijheid van elkaar / grouperen shapes -> Vlakken van maken



import the CSV with markers into google maps -> https://www.google.com/maps/d/u/0/edit?hl=en&mid=1rEXjvP8rAoK41iPF5tkkcRLcWMVaP8c&ll=52.03850518347734%2C4.366191369035044&z=15

and... profit!

![profit](experimental-result.png)