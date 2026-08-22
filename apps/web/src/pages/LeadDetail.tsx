import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Globe, Mail, MapPin, Phone, Sparkles, Trash2 } from 'lucide-react';
import Button from '../components/ui/Button';
import StatusBadge from '../components/ui/StatusBadge';
import ScoreIndicator from '../components/ui/ScoreIndicator';
import AuditRow from '../components/ui/AuditRow';
import { leadService } from '../services/leadService';

const tabs = ['Overview', 'Analysis', 'Website', 'Outreach'];

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('Overview');

  const { data, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => leadService.getLead(id!),
  });

  const deleteMutation = useMutation({
    mutationFn: () => leadService.deleteLead(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      navigate('/');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => leadService.updateLead(id!, { status } as any),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lead', id] }),
  });

  const generateDNAMutation = useMutation({
    mutationFn: () => leadService.generateBrandDNA(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lead', id] }),
  });

  const lead = data?.data;
  const websiteSpecification = lead?.generatedWebsite?.specification;

  const scoreDescription = useMemo(() => {
    if (!lead?.opportunityScore?.total) return 'Healthy local opportunity with clear digital conversion gaps.';
    if (lead.opportunityScore.total >= 80) return 'Strong opportunity with visible demand and a clear growth story.';
    if (lead.opportunityScore.total >= 60) return 'Promising lead with moderate urgency and a clear conversion path.';
    return 'There is potential, but the current digital presence needs strategic refinement.';
  }, [lead?.opportunityScore?.total]);

  if (isLoading) {
    return <div className="rounded-[28px] border border-[#E5E5EA] bg-white p-10 text-center text-sm text-[#6E6E73]">Loading lead workspace...</div>;
  }

  return (
    <div className="space-y-6">
      <header className="rounded-[30px] border border-[#E5E5EA] bg-white p-6 shadow-[0_18px_50px_rgba(17,17,17,0.03)] md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#6E6E73]">Lead detail</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.06em] text-[#111111] md:text-[2.7rem]">{lead?.businessName || 'Unknown business'}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[#6E6E73]">
              <span>{lead?.businessCategory || 'Local business'}</span>
              <span className="h-1 w-1 rounded-full bg-[#D2D2D7]" />
              <span>{lead?.location?.city || 'Location unavailable'}</span>
              <span className="h-1 w-1 rounded-full bg-[#D2D2D7]" />
              <span>{lead?.contact?.website ? 'Website present' : 'No website detected'}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={lead?.status || 'new'}
              onChange={(e) => updateStatusMutation.mutate(e.target.value)}
              className="rounded-full border border-[#D2D2D7] bg-[#F7F7F8] px-3 py-2 text-sm font-medium text-[#111111] outline-none focus:border-[#0A84FF]"
              aria-label="Lead status"
            >
              <option value="new">New</option>
              <option value="qualified">Qualified</option>
              <option value="contacted">Contacted</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
            <button
              onClick={() => deleteMutation.mutate()}
              className="inline-flex items-center gap-2 rounded-full border border-[#F0C5C2] bg-[#FDECEC] px-3 py-2 text-sm font-medium text-[#B42318] transition hover:bg-[#FBE2E2]"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-[#E5E5EA] pt-6">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={[
                'rounded-full px-3 py-2 text-sm font-medium transition',
                activeTab === tab ? 'bg-[#111111] text-white' : 'bg-[#F7F7F8] text-[#6E6E73] hover:text-[#111111]',
              ].join(' ')}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {activeTab === 'Overview' && (
        <div className="grid gap-6 xl:grid-cols-[1.03fr_0.97fr]">
          <div className="space-y-6">
            <div className="rounded-[30px] border border-[#E5E5EA] bg-white p-6 shadow-[0_18px_50px_rgba(17,17,17,0.03)]">
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold tracking-[-0.04em] text-[#111111]">Business profile</h2>
                <StatusBadge status={lead?.status || 'new'} />
              </div>

              <dl className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[20px] border border-[#E5E5EA] bg-[#F7F7F8] p-4">
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-[#6E6E73]">Location</dt>
                  <dd className="mt-3 flex items-center gap-2 text-sm text-[#111111]">
                    <MapPin className="h-4 w-4 text-[#6E6E73]" />
                    {lead?.location?.address || 'N/A'}
                  </dd>
                </div>
                <div className="rounded-[20px] border border-[#E5E5EA] bg-[#F7F7F8] p-4">
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-[#6E6E73]">Phone</dt>
                  <dd className="mt-3 flex items-center gap-2 text-sm text-[#111111]">
                    <Phone className="h-4 w-4 text-[#6E6E73]" />
                    {lead?.contact?.phone || 'N/A'}
                  </dd>
                </div>
                <div className="rounded-[20px] border border-[#E5E5EA] bg-[#F7F7F8] p-4">
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-[#6E6E73]">Email</dt>
                  <dd className="mt-3 flex items-center gap-2 text-sm text-[#111111]">
                    <Mail className="h-4 w-4 text-[#6E6E73]" />
                    {lead?.contact?.email || 'N/A'}
                  </dd>
                </div>
                <div className="rounded-[20px] border border-[#E5E5EA] bg-[#F7F7F8] p-4">
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-[#6E6E73]">Website</dt>
                  <dd className="mt-3 flex items-center gap-2 text-sm text-[#111111]">
                    <Globe className="h-4 w-4 text-[#6E6E73]" />
                    {lead?.contact?.website ? (
                      <a href={lead.contact.website} target="_blank" rel="noreferrer" className="text-[#0A84FF] hover:text-[#0077ED]">Visit</a>
                    ) : (
                      <span className="text-[#B42318]">No website</span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-[30px] border border-[#E5E5EA] bg-white p-6 shadow-[0_18px_50px_rgba(17,17,17,0.03)]">
              <h2 className="text-xl font-semibold tracking-[-0.04em] text-[#111111]">Business DNA</h2>
              <div className="mt-5 space-y-4">
                <div className="rounded-[20px] border border-[#E5E5EA] bg-[#F7F7F8] p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#6E6E73]">Audience</p>
                  <p className="mt-2 text-sm text-[#111111]">{lead?.businessDNA?.targetAudience || 'Unavailable'}</p>
                </div>
                <div className="rounded-[20px] border border-[#E5E5EA] bg-[#F7F7F8] p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#6E6E73]">Positioning</p>
                  <p className="mt-2 text-sm text-[#111111]">{lead?.businessDNA?.valueProposition || 'Unavailable'}</p>
                </div>
                <div className="rounded-[20px] border border-[#E5E5EA] bg-[#F7F7F8] p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#6E6E73]">Brand personality</p>
                  <p className="mt-2 text-sm text-[#111111]">{lead?.businessDNA?.brandPersonality || 'Unavailable'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <ScoreIndicator
              score={lead?.opportunityScore?.total ?? 0}
              label="Opportunity"
              description={scoreDescription}
            />

            <div className="rounded-[30px] border border-[#E5E5EA] bg-white p-6 shadow-[0_18px_50px_rgba(17,17,17,0.03)]">
              <h2 className="text-xl font-semibold tracking-[-0.04em] text-[#111111]">Digital audit</h2>
              <div className="mt-5 space-y-3">
                <AuditRow label="Website" value={lead?.digitalAudit ? 'Weak' : 'Unknown'} tone={lead?.digitalAudit ? 'bad' : 'neutral'} />
                <AuditRow label="Mobile UX" value={lead?.digitalAudit?.mobileOptimized ? 'Strong' : 'Weak'} tone={lead?.digitalAudit?.mobileOptimized ? 'good' : 'bad'} />
                <AuditRow label="Conversion" value={lead?.digitalAudit ? 'Needs work' : 'Not reviewed'} tone={lead?.digitalAudit ? 'bad' : 'neutral'} />
                <AuditRow label="SEO" value={lead?.digitalAudit ? 'Moderate' : 'Pending'} tone={lead?.digitalAudit ? 'neutral' : 'neutral'} />
                <AuditRow label="Trust" value={lead?.digitalAudit ? 'Strong' : 'Pending'} tone={lead?.digitalAudit ? 'good' : 'neutral'} />
              </div>
            </div>

            <div className="rounded-[30px] border border-[#E5E5EA] bg-white p-6 shadow-[0_18px_50px_rgba(17,17,17,0.03)]">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xl font-semibold tracking-[-0.04em] text-[#111111]">Recommended action</h2>
                <button
                  type="button"
                  onClick={() => generateDNAMutation.mutate()}
                  className="rounded-full bg-[#111111] px-3 py-2 text-xs font-medium text-white transition hover:bg-[#2A2A2A]"
                  disabled={generateDNAMutation.isPending}
                >
                  {generateDNAMutation.isPending ? 'Generating...' : 'Refresh analysis'}
                </button>
              </div>

              <div className="mt-5 rounded-[20px] border border-[#E5E5EA] bg-[#F7F7F8] p-4 text-sm leading-6 text-[#111111]">
                <p className="flex items-center gap-2 font-medium">
                  <Sparkles className="h-4 w-4 text-[#0A84FF]" />
                  Focus on a conversion-first landing page with a strong local CTA and trust signals.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Analysis' && (
        <div className="rounded-[30px] border border-[#E5E5EA] bg-white p-6 shadow-[0_18px_50px_rgba(17,17,17,0.03)]">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-[-0.04em] text-[#111111]">Opportunity breakdown</h2>
            <StatusBadge status={lead?.opportunityScore?.priority || 'high'} />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[22px] border border-[#E5E5EA] bg-[#F7F7F8] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#6E6E73]">Trust</p>
              <p className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-[#111111]">{lead?.businessData?.rating ?? 'N/A'}</p>
            </div>
            <div className="rounded-[22px] border border-[#E5E5EA] bg-[#F7F7F8] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#6E6E73]">Reviews</p>
              <p className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-[#111111]">{lead?.businessData?.reviewCount ?? 'N/A'}</p>
            </div>
            <div className="rounded-[22px] border border-[#E5E5EA] bg-[#F7F7F8] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#6E6E73]">Website</p>
              <p className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-[#111111]">{lead?.contact?.website ? 'Yes' : 'No'}</p>
            </div>
            <div className="rounded-[22px] border border-[#E5E5EA] bg-[#F7F7F8] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#6E6E73]">Score</p>
              <p className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-[#111111]">{lead?.opportunityScore?.total ?? 'N/A'}</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Website' && (
        <div className="rounded-[30px] border border-[#E5E5EA] bg-white p-6 shadow-[0_18px_50px_rgba(17,17,17,0.03)]">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-[-0.04em] text-[#111111]">Website preview</h2>
            <div className="flex items-center gap-2 rounded-full border border-[#E5E5EA] bg-[#F7F7F8] p-1">
              {['Desktop', 'Tablet', 'Mobile'].map((viewport) => (
                <button key={viewport} type="button" className="rounded-full px-3 py-1.5 text-xs font-medium text-[#6E6E73] hover:text-[#111111]">
                  {viewport}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.5fr_0.8fr]">
            <div className="rounded-[22px] border border-[#E5E5EA] bg-[#F7F7F8] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#6E6E73]">Sections</p>
              <div className="mt-4 space-y-2 text-sm text-[#111111]">
                {websiteSpecification?.sections?.length ? websiteSpecification.sections.map((section: { type?: string }) => (
                  <div key={section.type} className="rounded-xl border border-[#E5E5EA] bg-white px-3 py-2">{section.type || 'Section'}</div>
                )) : <div className="rounded-xl border border-[#E5E5EA] bg-white px-3 py-2 text-[#6E6E73]">Unavailable</div>}
              </div>
            </div>

            <div className="rounded-[28px] border border-[#E5E5EA] bg-[#F7F7F8] p-4">
              <div className="rounded-[20px] border border-[#E5E5EA] bg-white p-4 shadow-[0_14px_40px_rgba(17,17,17,0.04)]">
                <div className="rounded-[14px] bg-[#111111] p-6 text-white">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/70">{lead?.businessCategory || 'Business category unavailable'}</p>
                  <h3 className="mt-3 text-3xl font-semibold tracking-[-0.06em]">{websiteSpecification?.pageTitle || lead?.businessName || 'Website specification unavailable'}</h3>
                  <p className="mt-3 max-w-md text-sm text-white/80">{websiteSpecification?.pageDescription || 'Website specification unavailable.'}</p>
                  <div className="mt-6 flex gap-3">
                    <button type="button" className="rounded-full bg-white px-4 py-2 text-sm font-medium text-[#111111]">{websiteSpecification?.primaryCTA?.text || 'Unavailable'}</button>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {(websiteSpecification?.sections || []).filter((section: { type?: string }) => section.type === 'trustIndicators' || section.type === 'services' || section.type === 'location').slice(0, 3).map((section: { type?: string }) => (
                    <div key={section.type} className="rounded-2xl border border-[#E5E5EA] bg-[#F7F7F8] p-3 text-sm text-[#111111]">{section.type}</div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-[#E5E5EA] bg-[#F7F7F8] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#6E6E73]">Appearance</p>
              <div className="mt-4 space-y-3 text-sm text-[#111111]">
                <div className="rounded-xl border border-[#E5E5EA] bg-white px-3 py-2">Typography</div>
                <div className="rounded-xl border border-[#E5E5EA] bg-white px-3 py-2">Theme</div>
                <div className="rounded-xl border border-[#E5E5EA] bg-white px-3 py-2">CTA</div>
                <Button variant="secondary" size="sm" className="mt-2 w-full">Regenerate</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Outreach' && (
        <div className="rounded-[30px] border border-[#E5E5EA] bg-white p-6 shadow-[0_18px_50px_rgba(17,17,17,0.03)]">
          <h2 className="text-xl font-semibold tracking-[-0.04em] text-[#111111]">Outreach drafts</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {['WhatsApp', 'Email', 'Instagram', 'Call Script'].map((channel) => (
              <div key={channel} className="rounded-[22px] border border-[#E5E5EA] bg-[#F7F7F8] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#6E6E73]">{channel}</p>
                <p className="mt-3 text-sm leading-6 text-[#111111]">{channel === 'WhatsApp' ? 'Hi, I noticed your current digital presence...' : 'We can help improve...'}</p>
                <div className="mt-4 flex gap-2">
                  <button type="button" className="rounded-full bg-[#111111] px-3 py-2 text-xs font-medium text-white">Copy</button>
                  <button type="button" className="rounded-full border border-[#D2D2D7] bg-white px-3 py-2 text-xs font-medium text-[#111111]">Regenerate</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
