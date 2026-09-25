export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <span className="brand-symbol" aria-hidden="true">
        <svg viewBox="0 0 32 32">
          <path
            d="M6 7h20M6 16h20M6 25h20M9 7v18M16 7v18M23 7v18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.3"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {!compact && (
        <span>
          بلاعة<span className="brand-english">BALAA</span>
        </span>
      )}
    </span>
  );
}
