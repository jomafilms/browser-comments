'use client';

// Filter bar for the client comments page. The project dimension is NOT here —
// it lives in the header scope pill (ClientNav), which drives all pages.
// On small screens the row scrolls horizontally instead of stacking.

interface Assignee {
  id: number;
  name: string;
}

export type SortMode = 'recent' | 'resolved-bottom' | 'priority';

interface CommentsFilterBarProps {
  status: 'all' | 'open' | 'resolved';
  onStatus: (v: 'open' | 'resolved') => void;
  pages: string[];
  page: string;
  onPage: (v: string) => void;
  priority: string;
  onPriority: (v: string) => void;
  assignees: Assignee[];
  assignee: string;
  onAssignee: (v: string) => void;
  devices: string[];
  device: string;
  onDevice: (v: string) => void;
  sort: SortMode;
  onSort: (v: SortMode) => void;
  groupByPage: boolean;
  onGroupByPage: (v: boolean) => void;
}

const selectClasses =
  'w-28 px-2 py-1.5 border border-gray-300 rounded overflow-hidden text-ellipsis whitespace-nowrap flex-shrink-0';

export default function CommentsFilterBar({
  status, onStatus, pages, page, onPage, priority, onPriority,
  assignees, assignee, onAssignee, devices, device, onDevice,
  sort, onSort, groupByPage, onGroupByPage,
}: CommentsFilterBarProps) {
  return (
    <div className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 py-3 overflow-x-auto">
        <div className="flex gap-3 items-center min-w-max md:min-w-0 md:flex-wrap">
          <div className="flex gap-1 flex-shrink-0">
            {(['open', 'resolved'] as const).map((f) => (
              <button key={f} onClick={() => onStatus(f)} className={`px-3 py-1.5 rounded capitalize ${status === f ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>{f}</button>
            ))}
          </div>
          <select value={page} onChange={(e) => onPage(e.target.value)} className={selectClasses} title={page === 'all' ? 'Pages' : page}>
            <option value="all">Pages</option>
            {pages.map((p) => <option key={p} value={p}>{p.split('/').pop() || p}</option>)}
          </select>
          <select value={priority} onChange={(e) => onPriority(e.target.value)} className={selectClasses}>
            <option value="all">Priorities</option>
            <option value="high">High</option>
            <option value="med">Med</option>
            <option value="low">Low</option>
          </select>
          <select value={assignee} onChange={(e) => onAssignee(e.target.value)} className={selectClasses} title={assignee === 'all' ? 'Assignees' : assignee}>
            <option value="all">Assignees</option>
            <option value="Unassigned">Unassigned</option>
            {assignees.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
          </select>
          <select value={device} onChange={(e) => onDevice(e.target.value)} className={selectClasses} title={device === 'all' ? 'Devices' : device}>
            <option value="all">Devices</option>
            {devices.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <div className="flex gap-1 border-l pl-3 items-center flex-shrink-0">
            {(['recent', 'priority'] as const).map((s) => (
              <button key={s} onClick={() => onSort(s)} className={`px-3 py-1.5 rounded text-sm ${sort === s ? 'bg-purple-500 text-white' : 'bg-gray-200'}`}>
                {s === 'recent' ? 'Recent' : 'Priority'}
              </button>
            ))}
            {(sort === 'recent' || sort === 'priority') && (
              <label className="flex items-center gap-1.5 ml-2 text-sm text-gray-700 cursor-pointer whitespace-nowrap">
                <input type="checkbox" checked={groupByPage} onChange={(e) => onGroupByPage(e.target.checked)} />
                Group by page
              </label>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
