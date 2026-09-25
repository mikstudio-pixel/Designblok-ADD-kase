import type { DisplayRole } from '@/lib/display-calibration';

/** The side previews are a separate static bundle under /displays/. */
export function DisplaySwitcher({ current, sidePreview = false }: {
  current: DisplayRole | 'center';
  sidePreview?: boolean;
}) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const sides = sidePreview ? '?display=' : `${base}/displays/?display=`;
  const links = [
    { role: 'left', label: 'Levý', href: `${sides}left` },
    { role: 'center', label: 'Střed', href: sidePreview ? '../' : `${base}/` },
    { role: 'right', label: 'Pravý', href: `${sides}right` },
  ];
  return <nav className="display-switcher" aria-label="Výběr iPadu">
    <span>iPad</span>
    {links.map(({ role, label, href }) => <a key={role} href={href} aria-current={role === current ? 'page' : undefined}>{label}</a>)}
  </nav>;
}
