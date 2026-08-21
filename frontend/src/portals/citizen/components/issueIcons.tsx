import type { JSX } from 'react';
import { IconDeviceDesktop, IconHanger, IconSettings } from '@tabler/icons-react';

const iconClass = 'h-5 w-5';

export function IssueIcon({ code }: { code: string }): JSX.Element {
  const icons: Record<string, JSX.Element> = {
    roads: (
      <svg
        viewBox="0 0 24 24"
        className={iconClass}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 21 10 3h4l3 18" />
        <path d="M12 5v3M12 11v3M12 17v2" />
      </svg>
    ),
    water_sewage: (
      <svg
        viewBox="0 0 24 24"
        className={iconClass}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11Z" />
      </svg>
    ),
    electricity: (
      <svg
        viewBox="0 0 24 24"
        className={iconClass}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m13 2-8 11h6l-1 9 8-12h-6l1-8Z" />
      </svg>
    ),
    garbage: (
      <svg
        viewBox="0 0 24 24"
        className={iconClass}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 7h14M10 4h4l1 3H9l1-3ZM7 7l1 14h8l1-14" />
        <path d="M10 11v6M14 11v6" />
      </svg>
    ),
    clothes_waste: <IconHanger className={iconClass} stroke={1.8} />,
    metal_scrap: <IconSettings className={iconClass} stroke={1.8} />,
    e_waste: <IconDeviceDesktop className={iconClass} stroke={1.8} />,
    traffic_violation: (
      <svg
        viewBox="0 0 24 24"
        className={iconClass}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="7" y="3" width="10" height="18" rx="2" />
        <circle cx="12" cy="8" r="1.5" />
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="12" cy="16" r="1.5" />
      </svg>
    ),
    illegal_parking: (
      <svg
        viewBox="0 0 24 24"
        className={iconClass}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M10 17V7h3.5a3 3 0 0 1 0 6H10" />
      </svg>
    ),
    encroachment: (
      <svg
        viewBox="0 0 24 24"
        className={iconClass}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 20h16M6 20V9l6-5 6 5v11M9 20v-5h6v5" />
        <path d="M3 11h18" />
      </svg>
    ),
    dead_animal: (
      <svg
        viewBox="0 0 24 24"
        className={iconClass}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="8" cy="8" r="2" />
        <circle cx="16" cy="8" r="2" />
        <circle cx="6" cy="13" r="2" />
        <circle cx="18" cy="13" r="2" />
        <path d="M12 12c-3 0-5 2-5 4 0 2 2 3 5 3s5-1 5-3c0-2-2-4-5-4Z" />
      </svg>
    ),
    other: (
      <svg
        viewBox="0 0 24 24"
        className={iconClass}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9a2.5 2.5 0 0 1 4.6 1c0 2-2.5 2-2.5 4" />
        <circle cx="12" cy="17" r="0.8" fill="currentColor" />
      </svg>
    ),
  };

  return (
    icons[code] ?? (
      <svg
        viewBox="0 0 24 24"
        className={iconClass}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="8" />
      </svg>
    )
  );
}
