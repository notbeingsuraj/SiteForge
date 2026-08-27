import BusinessDataExtractor from "./src/services/BusinessDataExtractor.js";
import BusinessResearchService from "./src/services/BusinessResearchService.js";

const url = "https://www.google.com/maps/search/?api=1&query=Nilkamal+Homes+Elante+Mall+Chandigarh";
const extractedData = await BusinessDataExtractor.extractFromGoogleMapsUrl(url);
console.log("=== Extracted Data ===");
console.log("placeId:", extractedData.metadata.placeId);
console.log("placeName:", extractedData.metadata.placeName);

const intelligence = await BusinessResearchService.extractBusinessIntelligence(extractedData);
console.log("=== Business Intelligence ===");
console.log("source:", JSON.stringify(intelligence.source, null, 2));