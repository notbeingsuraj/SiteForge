import Lead from '../models/Lead.js';
import GoogleMapsService from '../services/GoogleMapsService.js';
import BusinessResearchService from '../services/BusinessResearchService.js';
import BrandStrategyService from '../services/BrandStrategyService.js';
import WebsiteStrategyService from '../services/WebsiteStrategyService.js';
import LandingPageSpecService from '../services/LandingPageSpecService.js';
import WebsiteCopywritingService from '../services/WebsiteCopywritingService.js';
import { config } from '../config/env.js';

export const createLead = async (req, res) => {
  let stage = 'resolving Google Maps business';
  try {
    const { googleMapsUrl, leadName, internalNotes, customInstructions, generateBrandDNA } = req.body;

    if (!BusinessResearchService.validateGoogleMapsUrl(googleMapsUrl)) {
      return res.status(400).json({ message: 'Invalid Google Maps URL' });
    }

    const { placeId: suppliedPlaceId, query } = await BusinessResearchService.resolveGoogleMapsUrl(googleMapsUrl);
    if (config.debugBusinessAnalysis) console.log('[Maps] Input URL:', googleMapsUrl);
    const place = suppliedPlaceId
      ? await GoogleMapsService.getPlaceDetails(suppliedPlaceId)
      : await GoogleMapsService.searchPlace(query || googleMapsUrl);
    const resolvedPlaceId = place.place_id;
    if (!resolvedPlaceId) throw new Error('Google Maps did not return a Place ID for this business');
    const businessData = suppliedPlaceId
      ? place
      : await GoogleMapsService.getPlaceDetails(resolvedPlaceId);

    if (config.debugBusinessAnalysis) {
      console.log('[Maps] Resolved Place ID:', resolvedPlaceId);
      console.log('[Maps] Business Name:', businessData.name);
      console.log('[Maps] Data Retrieved:', Object.keys(businessData));
      console.log('[AI] Business Data Sent To AI:', JSON.stringify(businessData).length, 'characters');
    }

    // Step 2: Extract and normalize business intelligence
    stage = 'normalizing business information';
    const intelligence = await BusinessResearchService.extractBusinessIntelligence(businessData);
    if (!resolvedPlaceId || !intelligence.identity.name) {
      throw new Error('Resolved Google Maps business is missing a Place ID or business name');
    }

    // Step 3: Generate Brand DNA (if requested)
    let brandDNA = null;
    let opportunityScore = null;
    let digitalAudit = null;

    let websiteStrategy = null;
    let landingPageSpec = null;
    let websiteCopy = null;
    if (generateBrandDNA !== false) {
      try {
        stage = 'auditing digital presence';
        // Perform digital audit first
        const DigitalAuditService = (await import('../services/DigitalAuditService.js')).default;
        digitalAudit = await DigitalAuditService.auditDigitalPresence(intelligence, {
          requestId: req.id,
          businessId: intelligence.identity.name,
        });

        // Generate Brand DNA
        stage = 'generating Business DNA';
        brandDNA = await BrandStrategyService.generateBrandDNA(intelligence, {
          requestId: req.id,
          businessId: intelligence.identity.name,
        });

        stage = 'generating website strategy';
        websiteStrategy = await WebsiteStrategyService.generateStrategy(brandDNA, digitalAudit, intelligence, {
          requestId: req.id,
          businessId: resolvedPlaceId,
        });
        stage = 'generating landing page specification';
        landingPageSpec = await LandingPageSpecService.generateSpec(brandDNA, websiteStrategy, digitalAudit, {
          requestId: req.id,
          businessId: resolvedPlaceId,
        });
        stage = 'generating website copy';
        websiteCopy = await WebsiteCopywritingService.generateCopy(brandDNA, websiteStrategy, landingPageSpec, intelligence, {
          requestId: req.id,
          businessId: resolvedPlaceId,
        });

        // Calculate opportunity score (includes digital gap)
        const score = BrandStrategyService.calculateOpportunityScore(brandDNA, intelligence);
        const digitalGap = DigitalAuditService.calculateDigitalGap(digitalAudit);
        const priority = BrandStrategyService.determinePriority(score);

        opportunityScore = {
          total: score,
          priority,
          breakdown: {
            digitalGap: Math.round(digitalGap * 0.3), // Weight digital gap at 30%
            trustSignals: Math.min(brandDNA.trustSignals.filter(t => t.verified).length * 8, 25),
            competitiveAdvantages: Math.min(brandDNA.competitiveAdvantages.length * 5, 20),
            businessMaturity: intelligence.trustSignals?.find(t => t.type === 'review_count')?.value > 50 ? 15 : 5,
          },
        };
      } catch (error) {
        console.error('Business analysis generation failed:', error);
        throw error;
      }
    }

    // Step 4: Create lead in database
    const lead = await Lead.create({
      businessName: intelligence.identity.name || leadName || 'Unknown Business',
      businessCategory: intelligence.identity.category,
      businessType: intelligence.identity.businessType,
      location: intelligence.location,
      contact: intelligence.contact,
      digitalPresence: { 
        googleMapsUrl, 
        socialProfiles: intelligence.digitalPresence.socialProfiles,
        hasWebsite: intelligence.digitalPresence.hasWebsite,
      },
      businessData: {
        placeId: resolvedPlaceId,
        description: intelligence.identity.description,
        services: intelligence.services,
        openingHours: businessData.opening_hours,
        rating: businessData.rating,
        reviewCount: businessData.user_ratings_total,
        priceLevel: businessData.price_level,
        photos: businessData.photos?.map(p => p.photo_reference),
      },
      businessDNA: brandDNA ? {
        targetAudience: brandDNA.audience.primary.segment,
        valueProposition: brandDNA.positioning.statement,
        brandPersonality: brandDNA.brandPersonality.primary,
        positioning: brandDNA.positioning.differentiation,
        trustSignals: brandDNA.trustSignals.filter(t => t.verified).map(t => t.signal),
        differentiators: brandDNA.competitiveAdvantages.filter(a => a.verified).map(a => a.advantage),
        primaryCTA: brandDNA.conversionStrategy.primaryCTA.text,
        secondaryCTA: brandDNA.conversionStrategy.secondaryCTA.text,
      } : undefined,
      digitalAudit: digitalAudit ? {
        hasWebsite: digitalAudit.websiteExists,
        websiteQuality: {
          score: digitalAudit.overallScore,
          issues: digitalAudit.weaknesses.map(w => w.description),
          strengths: digitalAudit.strengths.map(s => s.description),
        },
        mobileOptimized: digitalAudit.categories?.mobile?.score >= 7,
        seoScore: digitalAudit.categories?.seo?.score || 0,
        socialMediaPresence: intelligence.digitalPresence?.socialProfiles 
          ? Object.values(intelligence.digitalPresence.socialProfiles).filter(Boolean).length 
          : 0,
        criticalIssues: digitalAudit.criticalIssues,
        recommendations: digitalAudit.recommendations.slice(0, 5),
      } : undefined,
      websiteStrategy: websiteStrategy ? {
        recommendedApproach: websiteStrategy.websiteGoal,
        suggestedSections: websiteStrategy.homepageSections.map(section => section.section),
        keyFeatures: websiteStrategy.implementationNotes?.technicalRequirements || [],
        timeline: websiteStrategy.implementationNotes?.estimatedComplexity || null,
      } : undefined,
      generatedWebsite: landingPageSpec ? {
        specification: { ...landingPageSpec, copy: websiteCopy },
        generatedAt: new Date(),
      } : undefined,
      opportunityScore,
      status: brandDNA ? 'analysing' : 'new',
      internalNotes,
      customInstructions,
    });

    res.status(201).json({
      success: true, 
      data: lead, 
      intelligence,
      brandDNA: brandDNA ? BrandStrategyService.extractKeyInsights(brandDNA) : null,
      digitalAudit: digitalAudit ? {
        overallScore: digitalAudit.overallScore,
        websiteExists: digitalAudit.websiteExists,
        criticalIssuesCount: digitalAudit.criticalIssues.length,
        quickWins: digitalAudit.recommendations.filter(r => r.effort === 'low' && r.expectedImpact === 'high').slice(0, 3),
      } : null,
      websiteStrategy,
      landingPageSpec,
      websiteCopy,
    });
  } catch (error) {
    console.error('Create lead error:', error);
    const statusCode = error.message.startsWith('Invalid Google Maps URL') ? 400 : 502;
    res.status(statusCode).json({
      success: false,
      error: `Business analysis failed while ${stage}: ${error.message}`,
      message: `Business analysis failed while ${stage}: ${error.message}`,
    });
  }
};

export const getLeads = async (req, res) => {
  try {
    const { status, category, minScore, sort = '-createdAt' } = req.query;
    const query = {};
    
    if (status) query.status = status;
    if (category) query.businessCategory = category;
    if (minScore) query['opportunityScore.total'] = { $gte: parseInt(minScore) };

    const leads = await Lead.find(query).sort(sort);
    res.json({ success: true, count: leads.length, data: leads });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch leads', error: error.message });
  }
};

export const getLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    res.json({ success: true, data: lead });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch lead', error: error.message });
  }
};

export const updateLead = async (req, res) => {
  try {
    let lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    lead = await Lead.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json({ success: true, data: lead });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update lead', error: error.message });
  }
};

export const deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    await lead.deleteOne();
    res.json({ success: true, message: 'Lead deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete lead', error: error.message });
  }
};

export const getDashboardStats = async (req, res) => {
  try {
    const totalLeads = await Lead.countDocuments();
    const highPriority = await Lead.countDocuments({ 
      'opportunityScore.priority': { $in: ['high', 'critical'] }
    });
    const contacted = await Lead.countDocuments({ 
      status: { $in: ['contacted', 'follow_up', 'interested', 'proposal_sent', 'negotiation'] }
    });
    const won = await Lead.countDocuments({ status: 'won' });
    const websitesGenerated = await Lead.countDocuments({ 
      'generatedWebsite.specification': { $exists: true }
    });
    const recentLeads = await Lead.find()
      .sort('-createdAt').limit(10)
      .select('businessName businessCategory opportunityScore status createdAt businessDNA');

    res.json({ 
      success: true, 
      data: { 
        totalLeads, 
        highPriority, 
        contacted, 
        won,
        websitesGenerated,
        recentLeads 
      } 
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch dashboard stats', error: error.message });
  }
};

/**
 * @desc    Generate or regenerate Brand DNA for a lead
 * @route   POST /api/leads/:id/brand-dna
 * @access  Private
 */
export const generateBrandDNA = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    // Reconstruct intelligence from lead data
    const intelligence = {
      identity: {
        name: lead.businessName,
        category: lead.businessCategory,
        businessType: lead.businessType,
        description: lead.businessData?.description,
      },
      contact: lead.contact,
      location: lead.location,
      digitalPresence: lead.digitalPresence,
      services: lead.businessData?.services,
      trustSignals: [],
      positioning: {},
      facts: [],
      unknowns: [],
    };

    // Generate Brand DNA
    const brandDNA = await BrandStrategyService.generateBrandDNA(intelligence, {
      requestId: req.id,
      businessId: lead._id.toString(),
    });

    // Calculate opportunity score
    const score = BrandStrategyService.calculateOpportunityScore(brandDNA, intelligence);
    const priority = BrandStrategyService.determinePriority(score);

    // Update lead
    lead.businessDNA = {
      targetAudience: brandDNA.audience.primary.segment,
      valueProposition: brandDNA.positioning.statement,
      brandPersonality: brandDNA.brandPersonality.primary,
      positioning: brandDNA.positioning.differentiation,
      trustSignals: brandDNA.trustSignals.filter(t => t.verified).map(t => t.signal),
      differentiators: brandDNA.competitiveAdvantages.filter(a => a.verified).map(a => a.advantage),
      primaryCTA: brandDNA.conversionStrategy.primaryCTA.text,
      secondaryCTA: brandDNA.conversionStrategy.secondaryCTA.text,
    };

    lead.opportunityScore = {
      total: score,
      priority,
      breakdown: {
        digitalGap: !intelligence.digitalPresence?.hasWebsite ? 30 : 10,
        trustSignals: Math.min(brandDNA.trustSignals.filter(t => t.verified).length * 8, 25),
        competitiveAdvantages: Math.min(brandDNA.competitiveAdvantages.length * 5, 20),
        businessMaturity: 10,
      },
    };

    lead.status = 'qualified';
    await lead.save();

    res.json({
      success: true,
      data: lead,
      brandDNA: BrandStrategyService.extractKeyInsights(brandDNA),
      fullAnalysis: brandDNA,
    });
  } catch (error) {
    console.error('Generate Brand DNA error:', error);
    res.status(500).json({ message: 'Failed to generate Brand DNA', error: error.message });
  }
};
