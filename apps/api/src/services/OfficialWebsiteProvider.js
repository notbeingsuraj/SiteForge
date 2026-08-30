/**
 * OfficialWebsiteProvider
 * 
 * Fetches a supplied/discovered website and extracts structured data:
 * - JSON-LD / Schema.org
 * - Microdata
 * - OpenGraph
 * - Visible business information where appropriate
 * 
 * Preserves source URLs and provenance.
 * 
 * This provider does NOT discover websites on its own.
 * It only processes websites that are either:
 * a) Supplied directly by the user
 * b) Discovered by a DiscoveryProvider
 */

class OfficialWebsiteProvider {
  constructor() {
    this.axios = null; // Lazy init to avoid circular deps
  }

  /**
   * Get (or initialize) the HTTP client with SSRF protection
   * @private
   */
  _getClient() {
    if (this.axios) return this.axios;
    
    // Lazy import to avoid circular dependencies
    try {
      // Use require-style dynamic import
      const { config } = require('../config/env.js');
      this.config = config;
      
      // We need axios available
      const axios = require('axios');
      this.axios = axios.create({
        timeout: config.extraction.timeout,
        headers: {
          'User-Agent': config.extraction.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        maxRedirects: 5,
        validateStatus: (status) => status < 500,
      });
      return this.axios;
    } catch (e) {
      console.error('[OfficialWebsiteProvider] Failed to init HTTP client:', e.message);
      throw e;
    }
  }

  /**
   * Validate URL to prevent SSRF attacks
   * @param {string} url - URL to validate
   * @throws {Error} If URL is unsafe
   */
  validateFetchUrl(url) {
    const parsed = new URL(url);
    
    // Only allow HTTPS
    if (parsed.protocol !== "https:") {
      throw new Error("Only HTTPS URLs are allowed");
    }
    
    // Block private/internal IPs
    const hostname = parsed.hostname.toLowerCase();
    
    // Block localhost and common internal hostnames
    const blockedHostnames = ["localhost", "localhost.localdomain", "local"];
    if (blockedHostnames.includes(hostname)) {
      throw new Error("Localhost URLs are not allowed");
    }
    
    // Block private IP ranges
    // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Regex.test(hostname)) {
      const parts = hostname.split(".").map(Number);
      if (
        parts[0] === 10 ||
        parts[0] === 127 ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
        (parts[0] === 192 && parts[1] === 168) ||
        (parts[0] === 169 && parts[1] === 254)
      ) {
        throw new Error("Private IP addresses are not allowed");
      }
    }
    
    // Block IPv6 loopback and link-local
    if (hostname === "::1" || hostname.startsWith("fe80:")) {
      throw new Error("IPv6 internal addresses are not allowed");
    }
    
    return true;
  }

  /**
   * Fetch a website's HTML content
   * @param {string} url - Website URL to fetch
   * @returns {Promise<{url, html, status, headers}>}
   */
  async fetch(url) {
    this.validateFetchUrl(url);
    const client = this._getClient();

    try {
      const response = await client.get(url);
      return {
        url: response.request?.res?.responseUrl || url,
        html: response.data,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      if (error.response) {
        return {
          url,
          html: error.response.data || '',
          status: error.response.status,
          headers: error.response.headers,
          error: error.message,
        };
      }
      throw new Error(`Failed to fetch website: ${error.message}`);
    }
  }

  /**
   * Extract JSON-LD structured data from HTML
   * @param {string} html - HTML content
   * @returns {Array} Parsed JSON-LD objects
   */
  extractJsonLd(html) {
    const results = [];
    const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    
    while ((match = regex.exec(html)) !== null) {
      try {
        const json = JSON.parse(match[1]);
        results.push(json);
      } catch {
        // Ignore invalid JSON-LD
      }
    }
    
    return results;
  }

  /**
   * Extract microdata from HTML
   * @param {string} html - HTML content
   * @returns {Object} Extracted microdata keyed by itemprop
   */
  extractMicrodata(html) {
    const results = {};
    const itemPropRegex = /itemprop=["']([^"']+)["'][^>]*>([^<]*)</gi;
    
    let match;
    while ((match = itemPropRegex.exec(html)) !== null) {
      const prop = match[1];
      const value = match[2].trim();
      if (value && !results[prop]) {
        results[prop] = value;
      }
    }
    
    return results;
  }

  /**
   * Extract OpenGraph metadata from HTML
   * @param {string} html - HTML content
   * @returns {Object} OpenGraph metadata
   */
  extractOpenGraph(html) {
    const results = {};
    const regex = /<meta[^>]*property=["']og:([^"']+)["'][^>]*content=["']([^"']*)["']/gi;
    let match;
    
    while ((match = regex.exec(html)) !== null) {
      results[match[1]] = match[2];
    }
    
    return results;
  }

  /**
   * Extract visible text content from HTML (simplified)
   * @param {string} html - HTML content
   * @returns {string} Visible text
   */
  extractVisibleText(html) {
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return text.substring(0, 15000);
  }

  /**
   * Extract all structured metadata from a website
   * @param {string} html - HTML content
   * @returns {Object} Structured metadata
   */
  extractMetadata(html) {
    return {
      jsonLd: this.extractJsonLd(html),
      microdata: this.extractMicrodata(html),
      openGraph: this.extractOpenGraph(html),
      visibleText: this.extractVisibleText(html),
    };
  }
}