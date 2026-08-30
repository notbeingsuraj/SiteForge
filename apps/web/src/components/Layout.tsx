import { Outlet, Link, useLocation } from 'react-router-dom';
import Navbar from './Navbar';

export default function Layout() {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#111111]">
      <div className="mx-auto flex max-w-[1600px] gap-6 px-4 py-4 lg:px-6">
        <aside className="hidden w-72 shrink-0 rounded-[28px] border border-[#E5E5EA] bg-white/80 p-4 shadow-[0_12px_30px_rgba(17,17,17,0.03)] backdrop-blur-sm lg:block">
          <div className="flex h-full flex-col">
            <div className="px-3 pb-5 pt-2">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#111111] text-sm font-semibold text-white">S</div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[#6E6E73]">SiteForge</p>
                  <p className="text-sm font-medium text-[#111111]">Pipeline</p>
                </div>
              </div>
            </div>

            <nav className="mt-4 space-y-1">
              <SidebarItem label="Overview" to="/" active={location.pathname === '/'} />
              <SidebarItem label="Leads" to="/" active={location.pathname === '/'} />
              <SidebarItem label="Analyse" to="/leads/new" active={location.pathname === '/leads/new'} />
              <SidebarItem label="Websites" to="/websites" active={location.pathname === '/websites'} />
              <SidebarItem label="Settings" to="/" />
            </nav>

            <div className="mt-auto rounded-2xl border border-[#E5E5EA] bg-[#F7F7F8] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#6E6E73]">Focus</p>
              <p className="mt-2 text-sm font-medium text-[#111111]">Generate high-intent leads</p>
              <p className="mt-1 text-sm text-[#6E6E73]">30 businesses reviewed this week</p>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <Navbar />
          <main className="mx-auto max-w-[1180px] pb-10 pt-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

function SidebarItem({ label, to, active = false }: { label: string; to: string; active?: boolean }) {
  return (
    <Link
      to={to}
      className={[
        'flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
        active ? 'bg-[#111111] text-white' : 'text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#111111]',
      ].join(' ')}
    >
      <span className="inline-block h-2 w-2 rounded-full bg-current opacity-80" />
      <span className="ml-3">{label}</span>
    </Link>
  );
}

