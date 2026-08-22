import api from './api';

export interface Lead {
  _id: string;
  businessName: string;
  businessCategory?: string;
  status: string;
  opportunityScore?: {
    total: number;
    priority: string;
  };
  location?: {
    city?: string;
    state?: string;
  };
  contact?: {
    phone?: string;
    email?: string;
    website?: string;
  };
  businessData?: {
    rating?: number;
    reviewCount?: number;
  };
  generatedWebsite?: {
    specification?: {
      pageTitle?: string;
      pageDescription?: string;
      primaryCTA?: { text?: string };
      sections?: Array<{ type?: string; content?: { headline?: string } }>;
    };
  };
  createdAt: string;
}

export interface CreateLeadData {
  googleMapsUrl: string;
  leadName?: string;
  internalNotes?: string;
  customInstructions?: string;
}

export const leadService = {
  async createLead(data: CreateLeadData) {
    const response = await api.post('/leads', data);
    return response.data;
  },

  async getLeads(params?: any) {
    const response = await api.get('/leads', { params });
    return response.data;
  },

  async getLead(id: string) {
    const response = await api.get(`/leads/${id}`);
    return response.data;
  },

  async updateLead(id: string, data: Partial<Lead>) {
    const response = await api.put(`/leads/${id}`, data);
    return response.data;
  },

  async deleteLead(id: string) {
    const response = await api.delete(`/leads/${id}`);
    return response.data;
  },

  async getDashboardStats() {
    const response = await api.get('/leads/stats/dashboard');
    return response.data;
  },

  async generateBrandDNA(id: string) {
    const response = await api.post(`/leads/${id}/brand-dna`);
    return response.data;
  },
};
