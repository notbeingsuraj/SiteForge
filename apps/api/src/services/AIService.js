import axios from 'axios';
import { config } from '../config/env.js';

export const PROVIDER_ERROR_CATEGORIES = Object.freeze({
  AUTHENTICATION: 'AUTHENTICATION',
  QUOTA_EXHAUSTED: 'QUOTA_EXHAUSTED',
  RATE_LIMITED: 'RATE_LIMITED',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
});

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
      timeout: config.extraction.timeout,
      headers: {
        'Authorization': `Bearer ${config.omniroute.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  sanitizeSecretText(value) {
    if (typeof value !== 'string') return '';

    return value
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
      .replace(/Authorization\s*:\s*Bearer\s*[A-Za-z0-9._-]+/gi, 'Authorization: Bearer [REDACTED]')
      .replace(/api[_-]?key\s*[:=]\s*['\"]?[A-Za-z0-9._-]+/gi, 'api_key=[REDACTED]')
      .replace(/x-api-key\s*[:=]\s*['\"]?[A-Za-z0-9._-]+/gi, 'x-api-key=[REDACTED]')
      .replace(/sk-[A-Za-z0-9]{8,}/gi, '[REDACTED]')
      .replace(/cookie\s*[:=]\s*[^;\n]+/gi, 'cookie=[REDACTED]')
      .replace(/set-cookie\s*[:=]\s*[^;\n]+/gi, 'set-cookie=[REDACTED]');
  }

  classifyProviderError({ status, message, errorCode = null }) {
    const text = String(message || '').toLowerCase();

    if (status === 401 || /unauthorized|invalid api key|invalid_api_key|authentication|auth failed/i.test(text)) {
      return PROVIDER_ERROR_CATEGORIES.AUTHENTICATION;
    }

    if (status === 429 || /rate[_ -]?limit|too many requests|429/i.test(text)) {
      if (/quota|exhausted|limit reached|limit exceeded|reset after|all .* accounts have exhausted/i.test(text)) {
        return PROVIDER_ERROR_CATEGORIES.QUOTA_EXHAUSTED;
      }
      return PROVIDER_ERROR_CATEGORIES.RATE_LIMITED;
    }

    if (status === 402 || /billing|payment|insufficient funds|insufficient_funds/i.test(text)) {
      return PROVIDER_ERROR_CATEGORIES.PROVIDER_UNAVAILABLE;
    }

    if (status === 502 || status === 503 || /upstream|provider unavailable|temporar|gateway|service unavailable|bad gateway/i.test(text)) {
      return PROVIDER_ERROR_CATEGORIES.PROVIDER_UNAVAILABLE;
    }

    if (status === 403 || /forbidden|access denied|blocked|denied/i.test(text)) {
      return PROVIDER_ERROR_CATEGORIES.AUTHENTICATION;
    }

    if (/timeout|timed out|etimedout|esockettimedout/i.test(text)) {
      return PROVIDER_ERROR_CATEGORIES.TIMEOUT;
    }

    if (/empty response|invalid json|malformed json|json parse|returned invalid/i.test(text)) {
      return PROVIDER_ERROR_CATEGORIES.INVALID_RESPONSE;
    }

    if (errorCode) {
      const normalizedCode = String(errorCode).toLowerCase();
      if (normalizedCode.includes('quota')) return PROVIDER_ERROR_CATEGORIES.QUOTA_EXHAUSTED;
      if (normalizedCode.includes('timeout')) return PROVIDER_ERROR_CATEGORIES.TIMEOUT;
    }

    return PROVIDER_ERROR_CATEGORIES.PROVIDER_UNAVAILABLE;
  }

  normalizeProviderError({ status = null, message = '', model = null, provider = 'omniroute', retryAttempted = false, retryCount = 0, latencyMs = null, errorCode = null } = {}) {
    const safeMessage = this.sanitizeSecretText(message || 'AI provider request failed.');
    const category = this.classifyProviderError({ status, message: safeMessage, errorCode });

    return {
      category,
      provider,
      model: model || 'unknown',
      httpStatus: status ?? null,
      retryAttempted,
      retryCount,
      latencyMs,
      safeMessage: safeMessage || 'AI provider request failed.',
      success: false,
      errorCode: errorCode || null,
    };
  }

  getProviderDiagnostics({ gateway = config.omniroute.baseUrl, model = null, providerError = null, retryCount = 0, latencyMs = null, success = false } = {}) {
    return {
      gateway,
      model: model || config.omniroute.models.fast,
      providerErrorCategory: providerError?.category || null,
      httpStatus: providerError?.httpStatus ?? null,
      retryCount,
      latencyMs: latencyMs ?? null,
      success,
    };
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
  async generate({ prompt, model = 'fast', schema = null, temperature = 0.7, maxTokens = 4000, systemPrompt = null }) {
    if (!config.omniroute.apiKey) throw new Error('Missing OMNIROUTE_API_KEY');

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const payload = {
      model: this.selectModel(model),
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    };

    if (schema) {
      if (typeof schema === 'object' && schema !== null && schema.type === 'object') {
        payload.response_format = {
          type: 'json_schema',
          json_schema: {
            name: 'LandingPageSpec',
            strict: true,
            schema,
          }
        };
      } else {
        payload.response_format = { type: 'json_object' };
      }
    }

    const selectedModel = payload.model;
    if (config.debugBusinessAnalysis) {
      console.log('[AI] Provider: OmniRoute');
      console.log('[AI] Model:', selectedModel);
      console.log('[AI] Prompt Data Size:', prompt.length);
    }

    const maxAttempts = Math.max(1, Number(config.extraction.maxRetries || 2) + 1);
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const startedAt = Date.now();
      try {
        const response = await this.client.post('/chat/completions', payload);
        const message = response.data?.choices?.[0]?.message;
        let content = message?.content;

        if ((!content || !content.trim()) && message?.reasoning_content) {
          const reasoning = message.reasoning_content;
          const jsonMatch = reasoning.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            content = jsonMatch[0];
          }
        }

        if (typeof content !== 'string' || !content.trim()) {
          const invalidResponseError = new Error('AI provider returned an empty response');
          invalidResponseError.providerError = this.normalizeProviderError({
            status: null,
            message: invalidResponseError.message,
            model: selectedModel,
            provider: 'omniroute',
            retryAttempted: attempt > 1,
            retryCount: Math.max(0, attempt - 1),
            latencyMs: Date.now() - startedAt,
            errorCode: 'INVALID_RESPONSE',
          });
          invalidResponseError.category = invalidResponseError.providerError.category;
          throw invalidResponseError;
        }

        if (schema) {
          try {
            const parsed = JSON.parse(content);
            return parsed;
          } catch (e) {
            const malformedError = new Error('AI returned invalid JSON');
            malformedError.providerError = this.normalizeProviderError({
              status: null,
              message: malformedError.message,
              model: selectedModel,
              provider: 'omniroute',
              retryAttempted: attempt > 1,
              retryCount: Math.max(0, attempt - 1),
              latencyMs: Date.now() - startedAt,
              errorCode: 'INVALID_RESPONSE',
            });
            malformedError.category = malformedError.providerError.category;
            throw malformedError;
          }
        }

        if (config.debugBusinessAnalysis) console.log('[AI] Response Received:', content.length, 'characters');
        return content;
      } catch (error) {
        lastError = error;
        const status = error.response?.status ?? error.status ?? null;
        const bodyMessage = error.response?.data?.error?.message || error.response?.data?.message || error.message;
        const isRateLimit = status === 429 || /rate[_ -]?limit|429/i.test(String(bodyMessage));
        const sanitizedMessage = this.sanitizeSecretText(String(bodyMessage || error.message || 'AI provider request failed.'));
        const providerError = this.normalizeProviderError({
          status,
          message: sanitizedMessage,
          model: selectedModel,
          provider: 'omniroute',
          retryAttempted: attempt > 1,
          retryCount: Math.max(0, attempt - 1),
          latencyMs: Date.now() - startedAt,
          errorCode: error?.code || null,
        });

        if (isRateLimit && attempt < maxAttempts) {
          const delayMs = 500 * Math.pow(2, attempt - 1);
          await this.sleep(delayMs);
          continue;
        }

        const normalizedError = new Error(providerError.safeMessage);
        normalizedError.providerError = providerError;
        normalizedError.status = status;
        normalizedError.category = providerError.category;
        normalizedError.retryAttempted = attempt > 1 || providerError.retryAttempted;
        normalizedError.retryCount = Math.max(providerError.retryCount, attempt - 1);
        normalizedError.latencyMs = Date.now() - startedAt;
        normalizedError.safeMessage = providerError.safeMessage;
        throw normalizedError;
      }
    }

    const finalError = new Error(lastError?.providerError?.safeMessage || 'AI generation failed.');
    finalError.providerError = lastError?.providerError || this.normalizeProviderError({
      status: null,
      message: 'AI generation failed.',
      model: selectedModel,
      provider: 'omniroute',
      retryAttempted: false,
      retryCount: 0,
      latencyMs: null,
      errorCode: 'UNKNOWN_ERROR',
    });
    throw finalError;
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

export { AIService };
export default new AIService();
