
/**
 * GET /api/leads
 * List all leads with optional pagination
 * 
 * Query: page, limit, status
 * Returns: { leads: Lead[], pagination: {...} }
 */
router.get('/', (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;
    
    let leads = Array.from(leadCache.values());
    
    if (status) {
      leads = leads.filter(l => l.status === status);
    }
    
    // Sort by createdAt descending
    leads.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    const total = leads.length;
    const start = (page - 1) * limit;
    const paginatedLeads = leads.slice(start, start + limit);
    
    // Return minimal lead data for list view
    const minimalLeads = paginatedLeads.map(lead => ({
      _id: lead._id,
      businessName: lead.businessName,
      businessCategory: lead.businessCategory,
      status: lead.status,
      opportunityScore: lead.opportunityScore,
      location: lead.location,
      contact: lead.contact,
      businessData: lead.businessData,
      createdAt: lead.createdAt,
    }));

    res.json({
      success: true,
      data: minimalLeads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});


/**
 * GET /api/leads/:id
 * Get full lead details by ID
 */
router.get('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const lead = leadCache.get(id);
    
    if (!lead) {
      return res.status(404).json({ 
        error: 'Lead not found' 
      });
    }

    res.json({
      success: true,
      data: lead,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/leads/:id
 * Update lead (status, notes, etc.)
 */
router.put('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const lead = leadCache.get(id);
    
    if (!lead) {
      return res.status(404).json({ 
        error: 'Lead not found' 
      });
    }

    const allowedUpdates = ['status', 'leadName', 'internalNotes', 'customInstructions'];
    const updates = Object.keys(req.body)
      .filter(key => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        obj[key] = req.body[key];
        return obj;
      }, {});

    const updatedLead = { ...lead, ...updates, updatedAt: new Date().toISOString() };
    leadCache.set(id, updatedLead);

    res.json({
      success: true,
      data: updatedLead,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/leads/:id
 * Delete a lead
 */
router.delete('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!leadCache.has(id)) {
      return res.status(404).json({ 
        error: 'Lead not found' 
      });
    }

    leadCache.delete(id);

    res.json({
      success: true,
      message: 'Lead deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/leads/:id/brand-dna
 * Regenerate brand DNA for a lead
 */
router.post('/:id/brand-dna', async (req, res, next) => {
  try {
    const { id } = req.params;
    const lead = leadCache.get(id);
    
    if (!lead) {
      return res.status(404).json({ 
        error: 'Lead not found' 
      });
    }

    const brandDNA = await BrandStrategyService.generateBrandDNA(lead.analysis.businessData);
    
    // Update lead with new brand DNA
    lead.analysis.brandDNA = brandDNA;
    lead.updatedAt = new Date().toISOString();
    leadCache.set(id, lead);

    res.json({
      success: true,
      data: brandDNA,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
