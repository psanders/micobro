/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
interface IconProps {
  className?: string;
}

export function InstagramIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FacebookIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

export function WhatsAppIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M12 2a9 9 0 0 0-7.9 13.4L3 22l6.8-1.8A9 9 0 1 0 12 2z" />
      <path
        d="M8.5 8.5c-.3 1 .2 2.1 1 3.1 1 1.2 2.1 1.9 3.3 2.2.5.1 1-.1 1.3-.5l.4-.6c.2-.3.6-.4.9-.2l1.4.7c.3.2.5.6.4 1-.3 1-1.3 1.7-2.3 1.6-2.1-.2-4.2-1.3-5.7-3-1.2-1.3-1.9-2.8-2-4.3 0-1 .6-1.9 1.6-2.2.4-.1.8.1 1 .4l.6 1.4c.1.3 0 .7-.3.9z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
