// Small scope label shown next to section headings so it's always clear
// whether a setting is client-wide or per-project.
export default function ScopeBadge({ label }: { label: string }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-xs text-gray-500 whitespace-nowrap align-middle">
      {label}
    </span>
  );
}
