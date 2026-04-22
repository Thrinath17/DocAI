type IconProps = { size?: number };

const icon = (paths: React.ReactNode, size = 16, stroke = 1.5) => (
  <svg
    width={size} height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {paths}
  </svg>
);

export const UploadCloud = ({ size = 48 }: IconProps) => icon(
  <>
    <path d="M7 18a5 5 0 1 1 1.2-9.85A7 7 0 0 1 21 13a4 4 0 0 1-2 7H7Z" />
    <path d="M12 12v8" />
    <path d="m8.5 15.5 3.5-3.5 3.5 3.5" />
  </>,
  size, 1.2,
);

export const ChevronDown = ({ size = 14 }: IconProps) => icon(
  <path d="m6 9 6 6 6-6" />, size, 1.6,
);

export const CaretRight = ({ size = 14 }: IconProps) => icon(
  <path d="m9 6 6 6-6 6" />, size, 2,
);

export const ThumbUp = ({ size = 16 }: IconProps) => icon(
  <>
    <path d="M7 10v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3Z" />
    <path d="M7 10h3.5l1.5-6a2 2 0 0 1 2.6 2l-.6 4H19a2 2 0 0 1 2 2.3l-1.1 6A2 2 0 0 1 17.9 19H7" />
  </>,
  size,
);

export const ThumbDown = ({ size = 16 }: IconProps) => icon(
  <>
    <path d="M17 14V5h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-3Z" />
    <path d="M17 14h-3.5l-1.5 6a2 2 0 0 1-2.6-2l.6-4H5a2 2 0 0 1-2-2.3l1.1-6A2 2 0 0 1 6.1 5H17" />
  </>,
  size,
);

export const Dots = ({ size = 16 }: IconProps) => icon(
  <>
    <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none" />
  </>,
  size,
);

export const Download = ({ size = 14 }: IconProps) => icon(
  <>
    <path d="M12 4v12" />
    <path d="m7 11 5 5 5-5" />
    <path d="M4 20h16" />
  </>,
  size, 1.6,
);

export const X = ({ size = 14 }: IconProps) => icon(
  <><path d="M5 5l14 14M19 5 5 19" /></>,
  size, 1.6,
);

export const Refresh = ({ size = 14 }: IconProps) => icon(
  <>
    <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
    <path d="M3 21v-5h5" />
  </>,
  size, 1.6,
);

export const Archive = ({ size = 14 }: IconProps) => icon(
  <>
    <rect x="3" y="4" width="18" height="4" rx="1" />
    <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
    <path d="M10 12h4" />
  </>,
  size, 1.6,
);

export const Search = ({ size = 14 }: IconProps) => icon(
  <>
    <circle cx="11" cy="11" r="6" />
    <path d="m20 20-4-4" />
  </>,
  size, 1.6,
);

export const FileText = ({ size = 14 }: IconProps) => icon(
  <>
    <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8Z" />
    <path d="M14 3v5h5" />
    <path d="M8 13h8M8 17h5" />
  </>,
  size, 1.4,
);

export const Sun = ({ size = 16 }: IconProps) => icon(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </>,
  size,
);

export const Moon = ({ size = 16 }: IconProps) => icon(
  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
  size,
);
