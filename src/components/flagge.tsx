// Zypern-Flagge (vereinfacht): weißer Grund, kupferfarbene Insel, zwei Olivenzweige. Rein dekorativ.
export function ZypernFlagge({ className, titel = "Zypern" }: { className?: string; titel?: string }) {
  return (
    <svg viewBox="0 0 300 200" className={className} role="img" aria-label={titel}>
      <rect width="300" height="200" rx="18" fill="#ffffff" />
      <path
        d="M70 112 L80 97 L98 90 L118 86 L138 84 L156 80 L172 74 L190 66 L208 55 L232 41 L246 36 L236 49 L218 62 L204 73 L196 86 L190 100 L178 111 L160 118 L140 125 L117 128 L95 124 L80 120 Z"
        fill="#d57800"
      />
      <g fill="none" stroke="#4e5b31" strokeWidth="4" strokeLinecap="round">
        <path d="M150 168 C128 168 108 158 96 142" />
        <path d="M150 168 C172 168 192 158 204 142" />
      </g>
      <g fill="#4e5b31">
        {[[104, 150, -35], [116, 158, -20], [130, 164, -8], [196, 150, 35], [184, 158, 20], [170, 164, 8]].map(([x, y, r], i) => (
          <ellipse key={i} cx={x} cy={y} rx="9" ry="4" transform={`rotate(${r} ${x} ${y})`} />
        ))}
      </g>
    </svg>
  );
}
