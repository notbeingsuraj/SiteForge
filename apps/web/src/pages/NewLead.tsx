import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader, MapPin, Sparkles } from 'lucide-react';
import Button from '../components/ui/Button';
import { leadService } from '../services/leadService';

const progressSteps = [
  'Resolving business',
  'Analyzing digital presence',
  'Building Business DNA',
  'Calculating opportunity',
  'Preparing website strategy',
];

export default function NewLead() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    googleMapsUrl: '',
    leadName: '',
    internalNotes: '',
    customInstructions: '',
  });

  const createLeadMutation = useMutation({
    mutationFn: leadService.createLead,
    onSuccess: (data) => {
      navigate(`/leads/${data.data._id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createLeadMutation.mutate(formData);
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 rounded-[30px] border border-[#E5E5EA] bg-white p-6 shadow-[0_18px_50px_rgba(17,17,17,0.03)] md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#6E6E73]">Analysis</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.06em] text-[#111111] md:text-[2.7rem]">
              Turn local businesses into opportunities.
            </h1>
            <p className="mt-3 max-w-2xl text-base text-[#6E6E73]">
              Paste a Google Maps URL to uncover business value, identify digital gaps, and generate a premium outreach plan.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E5E5EA] bg-[#F7F7F8] px-3 py-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[#6E6E73]">
            <Sparkles className="h-3.5 w-3.5 text-[#0A84FF]" />
            Lead workflow
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <form onSubmit={handleSubmit} className="rounded-[30px] border border-[#E5E5EA] bg-white p-6 shadow-[0_18px_50px_rgba(17,17,17,0.03)] md:p-8">
          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#111111]">Google Maps URL</label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6E6E73]" />
                <input
                  type="url"
                  required
                  className="w-full rounded-[20px] border border-[#D2D2D7] bg-[#F7F7F8] py-4 pl-12 pr-4 text-base text-[#111111] outline-none transition focus:border-[#0A84FF] focus:bg-white"
                  placeholder="https://maps.google.com/?cid=123456789"
                  value={formData.googleMapsUrl}
                  onChange={(e) => setFormData({ ...formData, googleMapsUrl: e.target.value })}
                />
              </div>
              <p className="mt-2 text-sm text-[#6E6E73]">Example: https://maps.google.com/?cid=123456789</p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#111111]">Lead name</span>
                <input
                  type="text"
                  className="w-full rounded-[18px] border border-[#D2D2D7] bg-[#F7F7F8] px-4 py-3 text-[#111111] outline-none transition focus:border-[#0A84FF] focus:bg-white"
                  placeholder="Business name or account"
                  value={formData.leadName}
                  onChange={(e) => setFormData({ ...formData, leadName: e.target.value })}
                />
              </label>

              <div className="rounded-[18px] border border-dashed border-[#D2D2D7] bg-[#F7F7F8] px-4 py-3 text-sm text-[#6E6E73]">
                <p className="font-medium text-[#111111]">Workflow</p>
                <p className="mt-1">Business analysis → DNA → score → website → outreach</p>
              </div>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#111111]">Internal notes</span>
              <textarea
                rows={3}
                className="w-full rounded-[18px] border border-[#D2D2D7] bg-[#F7F7F8] px-4 py-3 text-[#111111] outline-none transition focus:border-[#0A84FF] focus:bg-white"
                placeholder="Customer notes, source details, or sales context"
                value={formData.internalNotes}
                onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#111111]">Custom instructions</span>
              <textarea
                rows={3}
                className="w-full rounded-[18px] border border-[#D2D2D7] bg-[#F7F7F8] px-4 py-3 text-[#111111] outline-none transition focus:border-[#0A84FF] focus:bg-white"
                placeholder="Desired positioning, brand tone, or special requirements"
                value={formData.customInstructions}
                onChange={(e) => setFormData({ ...formData, customInstructions: e.target.value })}
              />
            </label>

            {createLeadMutation.isError ? (
              <div className="rounded-[18px] border border-[#F0C5C2] bg-[#FDECEC] px-4 py-3 text-sm text-[#B42318]">
                {(createLeadMutation.error as any)?.response?.data?.error || (createLeadMutation.error as any)?.response?.data?.message || 'We could not retrieve reliable business information from this Maps URL.'}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => navigate('/')}>
                Cancel
              </Button>
              <Button type="submit" size="lg" disabled={createLeadMutation.isPending} trailingIcon={createLeadMutation.isPending ? undefined : <ArrowRight className="h-4 w-4" />}>
                {createLeadMutation.isPending ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Analysing...
                  </>
                ) : (
                  'Analyse Business'
                )}
              </Button>
            </div>
          </div>
        </form>

        <aside className="rounded-[30px] border border-[#E5E5EA] bg-[#F7F7F8] p-6 shadow-[0_18px_50px_rgba(17,17,17,0.03)]">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#6E6E73]">Status</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[#111111]">
            {createLeadMutation.isPending ? 'Processing lead' : 'Ready to review'}
          </h2>

          <div className="mt-6 space-y-4">
            {progressSteps.map((step, index) => (
              <div key={step} className="flex items-center gap-3">
                <div className={[
                  'flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold',
                  createLeadMutation.isPending && index === 0
                    ? 'bg-[#0A84FF] text-white'
                    : createLeadMutation.isPending && index > 0
                    ? 'bg-[#D8E9FF] text-[#0A84FF]'
                    : 'bg-white text-[#6E6E73] border border-[#D2D2D7]',
                ].join(' ')}>
                  {createLeadMutation.isPending ? index + 1 : '•'}
                </div>
                <span className={['text-sm', createLeadMutation.isPending ? 'text-[#111111]' : 'text-[#6E6E73]'].join(' ')}>{step}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-[22px] border border-[#E5E5EA] bg-white p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#6E6E73]">Why it works</p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[#111111]">
              <li>• Finds high-intent local opportunities</li>
              <li>• Measures digital weakness and opportunity</li>
              <li>• Recommends premium website strategy</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
