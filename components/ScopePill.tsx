'use client';

// The scope pill: states what this magic link can see, on every page.
// - Project token → fixed label (no switcher; the token IS the scope).
// - Client token + onChange → project switcher that drives the page's
//   project context ("All projects" or one project).
// - Client token, no onChange → static scope label (pages without a
//   project dimension, e.g. settings).

export interface PillProject {
  id: number;
  name: string;
  ref_prefix?: string | null;
}

interface ScopePillProps {
  isProjectToken: boolean;
  projects: PillProject[];
  selected?: string; // 'all' | project id as string
  onChange?: (value: string) => void;
}

const pillClasses =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-300 bg-gray-50 text-sm text-gray-700 max-w-[60vw]';

export default function ScopePill({ isProjectToken, projects, selected, onChange }: ScopePillProps) {
  if (projects.length === 0) return null;

  const label = (p: PillProject) => (p.ref_prefix ? `${p.name} (${p.ref_prefix})` : p.name);

  if (isProjectToken) {
    return (
      <span className={pillClasses} title="This link only sees this project">
        <span className="truncate">{label(projects[0])}</span>
        <span className="text-xs text-gray-400 whitespace-nowrap">· project link</span>
      </span>
    );
  }

  if (!onChange) {
    const current = selected && selected !== 'all' ? projects.find((p) => String(p.id) === selected) : null;
    return (
      <span className={pillClasses} title="This link sees all of this client's projects">
        <span className="truncate">{current ? label(current) : 'All projects'}</span>
      </span>
    );
  }

  return (
    <select
      value={selected || 'all'}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-1.5 rounded-full border border-gray-300 bg-gray-50 text-sm text-gray-700 cursor-pointer max-w-[60vw]"
      title="Choose which project you're looking at"
    >
      <option value="all">All projects</option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {label(p)}
        </option>
      ))}
    </select>
  );
}
