## What is Google Maps Scraper and how does it work?
This Google Maps scraper lets you get more and faster data from Google Places than the official [Google Places API](https://developers.google.com/places/web-service/search).

Our unofficial Google Maps API enables you to extract all of the following data from Google Maps:

➡️   Title, subtitle, category, place ID, and URL

➡️   Address, location, plus code and exact coordinates

➡️   Phone and website, if available

➡️   Menu and price, if available

➡️   Temporarily or permanently closed status

➡️   Popular times - histogram & live occupancy

➡️   Average rating (`totalScore`), review count, and review distribution

➡️   List of images (optional)

➡️   List of detailed characteristics (`additionalInfo`, optional)

➡️   Opening hours (optional)

➡️   People also search (optional)

The scraper also supports the scraping of all detailed information about reviews:

✅   Review text

✅   Published date

✅   Stars

✅   Review ID & URL

✅   Response from owner - text and published date

Personal data extraction about reviewers has to be **explicitly** enabled in input (see  [Personal data section](https://apify.com/drobnikj/crawler-google-places#personal-data)):

-   Reviewer name
-   Reviewer ID & URL
-   Reviewer number of reviews
-   Is Local Guide

Google Maps Scraper also provides other handy features:

✔️   Define search area - allows you to define the geographical area to scrape to a country, state, county, city, or postal code, thus speeding up the search (integration with Nominatim Maps API)

✔️   Automatic zooming - ensures maximum results

✔️   Language & translation settings

✔️   Reviews sorting

✔️   Proxy configuration

✔️   Browser & scraping configuration


## Define search area
### Country, state, county, city, and postal code vs. latitude and longitude

By reducing the radius of the geographical area to scrape, you will speed up the search and consume fewer platform credits. You can use any combination of the geolocation parameters: `country`, `state`, `county`,  `city` & `postalCode`.

Keep in mind that the first five fields and the coordinate options are mutually exclusive.

### Automatic zooming
The scraper automatically zooms the map to ensure maximum results are extracted. Higher zoom ensures more (less known) places are scraped. Logically, the smaller the area is, the higher zoom should be used. Currently, the default `zoom` values are:

- no location (`country` or `state`) -> 12 
- `county` -> 14 
- `city` -> 15 
- `postalCode` -> 16

If you need even more results or a faster run, you can override these values with the `zoom` input parameter. `zoom` can be any number between 1 (whole globe) and 21 (few houses).

### Custom search area
If your location can't be found or you want to customize it, you can use the custom search area function for the creation of start URLs. As an example, see the `geojson field` in [Nominatim API](https://nominatim.openstreetmap.org/) (see [here for the example of Cambridge in Great Britain](https://nominatim.openstreetmap.org/search?country=united%20kingdom&state=&city=cambridge&postalcode=&format=json&polygon_geojson=1&limit=1&polygon_threshold=0.005)).
There are several types of search area geometry that you can use. All follow official [GeoJSON RFC](https://datatracker.ietf.org/doc/html/rfc7946#section-3.1.2).

**Polygon**
The most common type is polygon, which is a set of points that define the location. The first and last coordinate must be equal (to close the polygon)!!!

**MultiPolygon**
MultiPolygon can combine more polygons that are not continuous together.

**Circle**
For a circle, we can use the Point type with our custom parameter `radiusKm`.

## How much will scraping Google Maps cost?
Apify provides you with $5 free usage credits to use every month on the Apify Free plan, and you could get up to 2,000 reviews from this Google Maps Scraper for those credits. But the number of platform credits you use depends on the complexity of your search. 

If you need to get more data regularly, you should grab an Apify subscription. We recommend our $49/month Personal plan - you can get up to 20,000 Google Maps results every month with the free $49 in monthly usage credits from that plan!

For more details about platform credits and usage, see the [Cost of usage tab](https://apify.com/drobnikj/crawler-google-places/cost-of-usage#features).

## What are the advantages over the Google Maps API?
With the Google Maps API, you get $200 worth of credit usage every month free of charge. That means 28,500 maploads per month. However, the Google Maps API caps your search results to 60, regardless of the radius you specify. So, if you want to scrape data for bars in New York, for example, you'll get results for only 60 of the thousands of bars in the area. 

Google Maps Scraper imposes no rate limits or quotas and provides more cost-effective, comprehensive results, and also scrapes histograms for popular times, which aren't available in the official API.

## Is it legal to scrape Google Maps?
Web scraping is legal if you are extracting publicly available data, but you should respect personal data and intellectual property regulations. You should only scrape personal data if you have a legitimate reason to do so, and you should also factor in Google's [Terms of Use](https://policies.google.com/terms?hl=en).

## How do I use Google Maps Scraper?
To understand how to configure and run the scraper, follow our step-by-step guide on [how to scrape Google Maps](https://blog.apify.com/step-by-step-guide-to-scraping-google-maps/) or [watch a short video tutorial](https://www.youtube.com/watch?v=Wzfo3qSSbtU)  &#9655; on YouTube. 

[![Apify - G Maps](https://img.youtube.com/vi/J43AX9wu-NI/0.jpg)](https://www.youtube.com/watch?v=J43AX9wu-NI)

## What can I use the extracted data from Google Maps for?
You can use the extracted data to:

👉🏽 create a potential customer base and prospecting files

👉🏽 find new clients

👉🏽 generate leads

👉🏽 search and analyze businesses similar to yours

👉🏽 monitor brand sentiment and service quality, and identify fake reviews

👉🏽 find where to buy products

👉🏽 analyze geo-spatial data for scientific or engineering work

👉🏽 develop a working market strategy

## Want more options?
### Google Maps Reviews Scraper ⭐️
If you only want to scrape reviews, this targeted data scraper is a great option. [Google Maps Reviews Scraper](https://apify.com/zenisjan/google-maps-reviews-scraper) extracts all reviews for a single place on Google Maps. 

All you need to do is enter the URL of the location you want to scrape, and you'll get a dataset of all reviews, which you can download for business analysis and market research.

### Easy Google Maps Scraper 🌎
If you want an easier but more limited Google Maps scraping tool, this is a very handy scraper if you're only looking to extract, say, 40 results rather than 400. [Google Maps Reviews Scraper](https://apify.com/zenisjan/google-maps-reviews-scraper) is set up and configured to make your scraping tasks super quick and easy.

### Google Places API Radar Search📍
To use this tool, you need to acquire your own Google API key, as you would use the official Google API. So, why use [Google Places API Radar Search](https://apify.com/alexey/google-maps-radar-search) instead of the API?

Nearby search with the official API returns only 60 results. Google Places API Radar Search overrides this limit and gets all places in a specified location.

### Gas Prices Scraper⛽️
Use [Gas Prices Scraper](https://apify.com/natasha.lekh/gas-prices-scraper) to find the lowest gas prices and timestamps of price updates from gas stations in your area.

## Find out more
For more ideas on how to use the extracted data, check out our [industries pages](https://apify.com/industries)  for concrete ways web scraping results are already being used across many projects and businesses of all types and sizes - in [travel and logistics](https://apify.com/industries/travel-and-logistics), for instance.

## Input
The Google Maps Scraper has the following input options. Click on the [input tab](https://apify.com/drobnikj/crawler-google-places/input-schema) for more information.

![Apify  -  G Maps  Scraper  input](https://i.imgur.com/AxyIJG2.png)

## Output
The output from Google Maps Scraper is stored in a dataset. After the run is finished, you can download the dataset in various data formats (JSON, CSV, XML, RSS, HTML Table).

### Output example
![Apify  -  G Maps  Scraper  input](https://i.imgur.com/RaeEvdb.png)

## Changelog
This scraper is under active development. We are always implementing new features and fixing bugs. If you would like to see a new feature, please submit an issue on GitHub. Check  [CHANGELOG.md](https://github.com/drobnikj/crawler-google-places/blob/master/CHANGELOG.md) for a list of recent updates.
