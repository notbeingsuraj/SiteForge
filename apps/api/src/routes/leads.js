
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
