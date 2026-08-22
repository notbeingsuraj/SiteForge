import axios from 'axios';
import { config } from '../config/env.js';

/**
 * AI Service - Unified interface for AI model interactions via OmniRoute
 * 
 * This service provides a single abstraction layer for all AI calls,
 * allowing easy model switching and routing.
 */

class AIService {
  constructor() {
    this.client = axios.create({
      baseURL: config.omniroute.baseUrl,
      headers: {
        'Authorization': `Bearer ${config.omniroute.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Generate AI completion
   * @param {Object} options - Generation options
   * @param {string} options.prompt - The prompt to send
   * @param {string} options.model - Model to use (fast, reasoning, coding, copywriting)
   * @param {Object} options.schema - Optional JSON schema for structured output
   * @param {number} options.temperature - Temperature (0-2)
   * @param {number} options.maxTokens - Max tokens to generate
   */
  async generate({ prompt, model = 'fast', schema = null, temperature = 0.7, maxTokens = 2000 }) {
    try {
      if (!config.omniroute.apiKey) throw new Error('Missing OMNIROUTE_API_KEY');
      const payload = {
        model: this.selectModel(model),
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature,
        max_tokens: maxTokens,
      };

      // If schema is provided, request structured JSON output
      if (schema) {
        payload.response_format = { type: 'json_object' };
      }

      const selectedModel = payload.model;
      if (config.debugBusinessAnalysis) {
        console.log('[AI] Provider: OmniRoute');
        console.log('[AI] Model:', selectedModel);
        console.log('[AI] Prompt Data Size:', prompt.length);
      }
      const response = await this.client.post('/chat/completions', payload);
      const content = response.data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        throw new Error('AI provider returned an empty response');
      }

      // Parse JSON if schema was requested
      if (schema) {
        try {
          return JSON.parse(content);
        } catch (e) {
          throw new Error('AI returned invalid JSON');
        }
      }

      if (config.debugBusinessAnalysis) console.log('[AI] Response Received:', content.length, 'characters');

      return content;
    } catch (error) {
      const detail = error.response?.data?.error?.message || error.message;
      throw new Error(`AI generation failed: ${detail}`);
    }
  }

  /**
   * Select appropriate model based on task type
   */
  selectModel(taskType) {
    return config.omniroute.models[taskType] || config.omniroute.models.fast;
  }

  /**
   * Log AI call for observability
   */
  async logAICall({ requestId, businessId, model, promptVersion, tokens, latency, error = null }) {
    // In production, this would log to a proper observability system.
    return { requestId, businessId, model, promptVersion, tokens, latency, error };
  }
}

export default new AIService();
