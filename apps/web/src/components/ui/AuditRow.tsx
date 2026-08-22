interface AuditRowProps {
  label: string;
  value: string;
  tone?: 'good' | 'neutral' | 'bad';
}

const toneStyles = {
  good: 'text-[#0A84FF] bg-[#EBF3FF] border-[#D8E9FF]',
  neutral: 'text-[#111111] bg-[#F5F5F7] border-[#E5E5EA]',
  bad: 'text-[#B42318] bg-[#FDECEC] border-[#F0C5C2]',
};

export default function AuditRow({ label, value, tone = 'neutral' }: AuditRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#E5E5EA] bg-white px-4 py-3">
      <span className="text-sm text-[#111111]">{label}</span>
      <span className={['inline-flex rounded-full border px-2.5 py-1 text-xs font-medium', toneStyles[tone]].join(' ')}>{value}</span>
    </div>
  );
}
