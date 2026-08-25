import AIService from './AIService.js';
import { buildQualityAssurancePrompt } from '../prompts/qualityAssurance.js';

class QualityAssuranceService {
  async reviewOutputs(businessData, generatedOutputs, options = {}) {
    try {
      const startTime = Date.now();
      if (!businessData || !generatedOutputs) {
        throw new Error('Business data and generated outputs are required');
      }
      const prompt = buildQualityAssurancePrompt(businessData, generatedOutputs);
      const qaResults = await AIService.generate({
        prompt,
        model: 'reasoning',
        schema: true,
        temperature: 0.3,
        maxTokens: 6000,
      });
      const latency = Date.now() - startTime;
      this.validateQAResults(qaResults);
      await AIService.logAICall({
        requestId: options.requestId || null,
        businessId: options.businessId || null,
        model: 'reasoning',
        promptVersion: 'quality-assurance-v1',
        tokens: null,
        latency,
        error: null,
      });
      return { ...qaResults, metadata: { reviewedAt: new Date().toISOString(), version: 'v1', latency } };
    } catch (error) {
      console.error('Quality assurance review error:', error);
      await AIService.logAICall({
        requestId: options.requestId || null,
        businessId: options.businessId || null,
        model: 'reasoning',
        promptVersion: 'quality-assurance-v1',
        tokens: null,
        latency: null,
        error: error.message,
      });
      throw new Error(`Failed to review outputs: ${error.message}`);
    }
  }

  validateQAResults(qaResults) {
    const required = ['passed', 'severity', 'score', 'issues', 'fixes', 'summary'];
    for (const field of required) {
      if (qaResults[field] === undefined) throw new Error(`Missing required field in QA results: ${field}`);
    }
    if (typeof qaResults.passed !== 'boolean') throw new Error('QA results "passed" must be boolean');
    if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(qaResults.severity)) throw new Error('Invalid severity level in QA results');
    return true;
  }

  extractSummary(qaResults) {
    return {
      passed: qaResults.passed,
      severity: qaResults.severity,
      score: qaResults.score,
      totalIssues: qaResults.summary.totalIssues,
      criticalIssues: qaResults.summary.critical,
      recommendation: qaResults.summary.recommendation,
      fabricatedFacts: qaResults.summary.fabricatedFacts,
      fakeTestimonials: qaResults.summary.fakeTestimonials,
    };
  }

  getCriticalIssues(qaResults) {
    return qaResults.issues.filter(issue => issue.severity === 'CRITICAL');
  }

  getHighPriorityIssues(qaResults) {
    return qaResults.issues.filter(issue => ['CRITICAL', 'HIGH'].includes(issue.severity));
  }

  shouldReject(qaResults) {
    return !qaResults.passed || qaResults.severity === 'CRITICAL' || qaResults.summary.fabricatedFacts || qaResults.summary.fakeTestimonials || qaResults.summary.recommendation === 'REJECT';
  }

  getIssuesByCategory(qaResults, category) {
    return qaResults.issues.filter(issue => issue.category === category);
  }

  getFabricatedFacts(qaResults) {
    return this.getIssuesByCategory(qaResults, 'fabricated_facts');
  }

  getFakeTestimonials(qaResults) {
    return this.getIssuesByCategory(qaResults, 'fake_testimonials');
  }

  getUnsupportedClaims(qaResults) {
    return this.getIssuesByCategory(qaResults, 'unsupported_claims');
  }

  getGenericCopyIssues(qaResults) {
    return this.getIssuesByCategory(qaResults, 'generic_copy');
  }

  calculatePassRate(qaResults) {
    if (qaResults.summary.totalIssues === 0) return 100;
    const weightedScore = (qaResults.summary.critical * 25) + (qaResults.summary.high * 10) + (qaResults.summary.medium * 5) + (qaResults.summary.low * 1);
    const maxPossibleScore = qaResults.summary.totalIssues * 25;
    const passRate = Math.max(0, 100 - (weightedScore / maxPossibleScore) * 100);
    return Math.round(passRate);
  }

  formatReport(qaResults) {
    const summary = this.extractSummary(qaResults);
    return {
      status: qaResults.passed ? 'PASSED' : 'FAILED',
      score: qaResults.score,
      severity: qaResults.severity,
      recommendation: qaResults.summary.recommendation,
      issues: { total: summary.totalIssues, critical: summary.criticalIssues, high: qaResults.summary.high, medium: qaResults.summary.medium, low: qaResults.summary.low },
      flags: { fabricatedFacts: summary.fabricatedFacts, fakeTestimonials: summary.fakeTestimonials },
      details: qaResults.issues,
      fixes: qaResults.fixes,
    };
  }

  hasCriticalFailure(qaResults) {
    return qaResults.summary.fabricatedFacts || qaResults.summary.fakeTestimonials || qaResults.summary.critical > 0;
  }
}

export default new QualityAssuranceService();
