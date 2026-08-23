import axios from 'axios';
import { config } from '../config/env.js';

/**
 * Google Maps Service
 * 
 * Fetches business information from Google Maps/Places API
 * This is a placeholder implementation - you'll need to add Google Places API key
 */

class GoogleMapsService {
  constructor() {
    this.apiKey = config.googleMapsApiKey;
    this.baseUrl = 'https://maps.googleapis.com/maps/api/place';
  }

  /**
   * Fetch business details from Google Maps Place ID
   */
  async getPlaceDetails(placeId) {
    if (!this.apiKey) {
      throw new Error('Missing GOOGLE_MAPS_API_KEY');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/details/json`, {
        params: {
          place_id: placeId,
          fields: 'name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,reviews,photos,opening_hours,types,geometry,address_components,price_level,business_status,editorial_summary,url,place_id',
          key: this.apiKey,
        },
      });

      if (response.data.status === 'OK') {
        if (response.data.result.place_id !== placeId) {
          throw new Error('Google Maps returned a different business than the supplied Place ID');
        }
        return response.data.result;
      } else {
        throw new Error(`Google Maps API error: ${response.data.status}`);
      }
    } catch (error) {
      console.error('Google Maps Service error:', error.message);
      throw error;
    }
  }

  /**
   * Search for a place by query
   */
  async searchPlace(query) {
    if (!this.apiKey) {
      throw new Error('Missing GOOGLE_MAPS_API_KEY');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/findplacefromtext/json`, {
        params: {
          input: query,
          inputtype: 'textquery',
          fields: 'place_id,name,formatted_address',
          key: this.apiKey,
        },
      });

      if (response.data.status === 'OK' && response.data.candidates.length > 0) {
        return response.data.candidates[0];
      } else {
        throw new Error('Business not found');
      }
    } catch (error) {
      console.error('Google Maps search error:', error.message);
      throw error;
    }
  }
}

export default new GoogleMapsService();
