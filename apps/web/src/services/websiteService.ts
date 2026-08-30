import api from './api';

export interface GeneratedSite {
  slug: string;
  port?: number | null;
  url?: string | null;
  status: string;
  startedAt?: string | null;
  path?: string | null;
  pid?: number | null;
}

export interface GenerateWebsiteResponse {
  success: boolean;
  website?: GeneratedSite;
  websiteId?: string;
  url?: string;
  port?: number;
  status?: string;
  error?: string;
}

export interface GeneratePayload {
  googleMapsUrl?: string;
  /** Pre-analyzed business intelligence object (requires identity.name). */
  business?: unknown;
  name?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  strategy?: unknown;
  copy?: unknown;
  spec?: unknown;
}

export const websiteService = {
  /** Generate a local website (from a Google Maps URL or pre-analyzed business). */
  async generate(payload: GeneratePayload, onStatus?: (message: string) => void) {
    onStatus?.('Generating website…');
    const response = await api.post<GenerateWebsiteResponse>('/website/generate', payload);
    onStatus?.('Website ready.');
    return response.data;
  },

  /** List all generated sites with status/port/url. */
  async list() {
    const response = await api.get<{ success: boolean; sites: GeneratedSite[] }>('/website/list');
    return response.data;
  },

  /** Start (or restart) a previously generated site. */
  async start(slug: string) {
    const response = await api.post<{ success: boolean; website: GeneratedSite }>(`/website/${slug}/start`);
    return response.data;
  },

  /** Stop a running generated site. */
  async stop(slug: string) {
    const response = await api.post<{ success: boolean; website: GeneratedSite }>(`/website/${slug}/stop`);
    return response.data;
  },

  /** Regenerate a site (rebuild + restart; optionally from a fresh URL). */
  async regenerate(slug: string, payload: GeneratePayload = {}) {
    const response = await api.post<{ success: boolean; website: GeneratedSite }>(`/website/${slug}/regenerate`, payload);
    return response.data;
  },

  /** Permanently delete a generated site. */
  async remove(slug: string) {
    const response = await api.delete<{ success: boolean; website: { slug: string; deleted: boolean } }>(`/website/${slug}`);
    return response.data;
  },
};

export default websiteService;