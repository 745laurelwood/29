import React from 'react';

interface FaceArtProps {
  rank: number;
  className?: string;
}

/** Minimal line-art face drawings for J/Q/K, inspired by classic playing
 *  card art: profile figure with crown/hat and a held prop.
 *  Single-color via currentColor so the parent's text color drives everything. */
export const FaceArt: React.FC<FaceArtProps> = ({ rank, className = '' }) => {
  if (rank === 13) return <KingArt className={className} />;
  if (rank === 12) return <QueenArt className={className} />;
  if (rank === 11) return <JackArt className={className} />;
  return null;
};

const KingArt: React.FC<{ className: string }> = ({ className }) => {
  const stroke = '#111';
  const sw = 0.6;
  return (
    <svg viewBox="0 0 40 56" className={className} aria-hidden="true">
      <g transform="translate(2 -3) scale(0.88)">
        {/* Yellow jagged crown */}
        <path
          d="M11 19 L12 14 L14 16 L16 12 L18 15 L20 11 L22 15 L24 12 L26 16 L28 14 L29 19 Z"
          fill="#f4c13a"
          stroke={stroke}
          strokeWidth={sw}
        />

        {/* Black hair tufts peeking out on the sides */}
        <path
          d="M11 19 Q10.5 23 13.5 24 L13.5 20 Q12 19.5 11 19 Z"
          fill="#111"
          stroke={stroke}
          strokeWidth={sw}
        />
        <path
          d="M29 19 Q29.5 23 26.5 24 L26.5 20 Q28 19.5 29 19 Z"
          fill="#111"
          stroke={stroke}
          strokeWidth={sw}
        />

        {/* Peach face */}
        <path
          d="M14 20 Q14 31 17 32.2 Q20 33 23 32.2 Q26 31 26 20 Q26 19.2 20 19.2 Q14 19.2 14 20 Z"
          fill="#fbd4a5"
          stroke={stroke}
          strokeWidth={sw}
        />

        {/* Blue eyes */}
        <circle cx="17" cy="24" r="1.1" fill="#2956b8" />
        <circle cx="23" cy="24" r="1.1" fill="#2956b8" />

        {/* Small mustache — thin strip under the nose */}
        <path d="M17.5 28.5 Q20 27.7 22.5 28.5 Q20 29.4 17.5 28.5 Z" fill="#111" />

        {/* Doublet — suit color (drawn before beard so beard overlays the neckline) */}
        <path d="M9 54 Q9 40 14 37 Q20 35.5 26 37 Q31 40 31 54 Q31 56 29 56 L11 56 Q9 56 9 54 Z" fill="currentColor" stroke={stroke} strokeWidth={sw} />

        {/* Yellow vertical stripe */}
        <rect x="19" y="37.5" width="2" height="18.5" fill="#f4c13a" stroke={stroke} strokeWidth={0.3} />

        {/* Big black beard — straight top, sides hug the jawline, subtle teeth at bottom */}
        <path
          d="M14.5 29 L25.5 29 Q26 31.5 25 33.5 L23 35.5 L21 34.5 L19.5 36 L18 34.5 L16 35.5 Q14 33.5 14.5 31 Q14 30 14.5 29 Z"
          fill="#111"
          stroke={stroke}
          strokeWidth={sw}
        />

        {/* Red lips peeking through the beard */}
        <path d="M18.5 31.5 Q20 32.3 21.5 31.5 Q20 32 18.5 31.5 Z" fill="#c0392b" />
      </g>
    </svg>
  );
};

const QueenArt: React.FC<{ className: string }> = ({ className }) => {
  const stroke = '#111';
  const sw = 0.6;
  return (
    <svg viewBox="0 0 40 56" className={className} aria-hidden="true">
      <g transform="translate(3.6 0.4) scale(0.82)">
        {/* Hair fill — face+neck cutout, no stroke */}
        <path
          fillRule="evenodd"
          d="M 8 44 Q 6 28 11 19 Q 9 12 20 11 Q 31 12 29 19 Q 34 28 32 44 Z M 14 20 Q 14 31 17 32.2 Q 13 37 12 44 L 28 44 Q 27 37 23 32.2 Q 26 31 26 20 Q 26 19.2 20 19.2 Q 14 19.2 14 20 Z"
          fill="#111"
        />

        {/* Hair outer outline — open path (no bottom closing line) */}
        <path
          d="M 8 44 Q 6 28 11 19 Q 9 12 20 11 Q 31 12 29 19 Q 34 28 32 44"
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
        />

        {/* Peach face */}
        <path
          d="M14 20 Q14 31 17 32.2 Q20 33 23 32.2 Q26 31 26 20 Q26 19.2 20 19.2 Q14 19.2 14 20 Z"
          fill="#fbd4a5"
          stroke={stroke}
          strokeWidth={sw}
        />

        {/* Small yellow crown sitting on top of hair */}
        <path
          d="M15 14 L16 9 L18 12 L20 7.5 L22 12 L24 9 L25 14 Z"
          fill="#f4c13a"
          stroke={stroke}
          strokeWidth={sw}
        />

        {/* Blue eyes */}
        <circle cx="17" cy="24" r="1.1" fill="#2956b8" />
        <circle cx="23" cy="24" r="1.1" fill="#2956b8" />

        {/* Red lips */}
        <path d="M17.5 30 Q20 31.5 22.5 30 Q20 31 17.5 30 Z" fill="#c0392b" stroke={stroke} strokeWidth={0.3} />

        {/* Doublet — drawn last so it sits in front of the hair */}
        <path d="M9 54 Q9 40 14 37 Q20 35.5 26 37 Q31 40 31 54 Q31 56 29 56 L11 56 Q9 56 9 54 Z" fill="currentColor" stroke={stroke} strokeWidth={sw} />

        {/* Yellow vertical stripe */}
        <rect x="19" y="37.5" width="2" height="18.5" fill="#f4c13a" stroke={stroke} strokeWidth={0.3} />
      </g>
    </svg>
  );
};

const JackArt: React.FC<{ className: string }> = ({ className }) => {
  const stroke = '#111';
  const sw = 0.6;
  return (
    <svg viewBox="0 0 40 56" className={className} aria-hidden="true">
      <g transform="translate(2 -3) scale(0.88)">
      {/* Black hair — full head, parted slightly to one side, coming down sides */}
      <path
        d="M11 19 Q9 12 20 11 Q31 12 29 19 Q29.5 23 26.5 24 L26.5 20 Q24 18.5 20 18.5 Q17 18.5 16 19.5 L13.5 20 L13.5 24 Q10.5 23 11 19 Z"
        fill="#111"
        stroke={stroke}
        strokeWidth={sw}
      />

      {/* Peach face */}
      <path
        d="M14 20 Q14 31 17 32.2 Q20 33 23 32.2 Q26 31 26 20 Q26 19.2 20 19.2 Q14 19.2 14 20 Z"
        fill="#fbd4a5"
        stroke={stroke}
        strokeWidth={sw}
      />

      {/* Blue eyes */}
      <circle cx="17" cy="24" r="1.1" fill="#2956b8" />
      <circle cx="23" cy="24" r="1.1" fill="#2956b8" />

      {/* Handlebar mustache */}
      <path
        d="M15 28.5 Q13 30 12 32.8 Q15 31 17 30.5 Q20 30 23 30.5 Q25 31 28 32.8 Q27 30 25 28.5 Q22.5 29.2 20 29.2 Q17.5 29.2 15 28.5 Z"
        fill="#111"
      />

      {/* Red lips */}
      <path d="M17.2 31.6 Q20 33.2 22.8 31.6 Q20 32.6 17.2 31.6 Z" fill="#c0392b" stroke={stroke} strokeWidth={0.3} />

      {/* Green bowtie */}
      <path d="M14 35 L17.5 33 L17.5 37 L14 35 Z" fill="#2ea26b" stroke={stroke} strokeWidth={sw} />
      <path d="M26 35 L22.5 33 L22.5 37 L26 35 Z" fill="#2ea26b" stroke={stroke} strokeWidth={sw} />
      <rect x="18" y="33.5" width="4" height="3" fill="#2ea26b" stroke={stroke} strokeWidth={sw} />

      {/* Doublet / torso — inherits suit color (black or red) via currentColor */}
      <path d="M9 54 Q9 40 14 37 Q20 35.5 26 37 Q31 40 31 54 Q31 56 29 56 L11 56 Q9 56 9 54 Z" fill="currentColor" stroke={stroke} strokeWidth={sw} />

      {/* Yellow vertical stripe */}
      <rect x="19" y="37.5" width="2" height="18.5" fill="#f4c13a" stroke={stroke} strokeWidth={0.3} />
      </g>
    </svg>
  );
};
