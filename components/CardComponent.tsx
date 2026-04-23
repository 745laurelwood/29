import React from 'react';
import { Card } from '../types';
import { SUIT_COLORS, SUIT_SYMBOLS, getRankLabel, Z_CARD_SELECTED } from '../constants';
import { FaceArt } from './FaceArt';

interface CardProps {
  card: Card;
  onClick?: (e: React.MouseEvent) => void;
  isSelected?: boolean;
  isPlayable?: boolean;
  isDimmed?: boolean;
  className?: string;
  faceDown?: boolean;
  small?: boolean;
  flipId?: string;
}

/** A single playing card — either face-up or face-down. */
export const CardComponent: React.FC<CardProps> = ({
  card,
  onClick,
  isSelected = false,
  isPlayable = false,
  isDimmed = false,
  className = '',
  faceDown = false,
  small = false,
  flipId,
}) => {
  const label = getRankLabel(card.rank);
  const colorClass = SUIT_COLORS[card.suit];
  const symbol = SUIT_SYMBOLS[card.suit];
  const sizeClass = small
    ? 'w-10 h-14 text-xs'
    : 'w-14 h-20 sm:w-16 sm:h-24 md:w-20 md:h-28 lg:w-24 lg:h-36';
  const flipAttr = flipId ?? card.id;

  if (faceDown) {
    return (
      <div
        data-card-id={flipAttr}
        className={`
          relative rounded-lg card-shadow card-transition
          ${sizeClass} flex items-center justify-center overflow-hidden
          ${className}
        `}
        style={{
          background: 'linear-gradient(155deg, #182335 0%, #0c121c 60%, #131a26 100%)',
          border: '1px solid rgba(111,176,255,0.18)',
        }}
      >
        <div className="absolute inset-1 rounded" style={{ border: '1px solid rgba(111,176,255,0.08)' }} />
        <div
          className="absolute inset-0 opacity-20"
          style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/black-scales.png')" }}
        />
        <div className="absolute text-3xl font-display" style={{ color: 'rgba(111,176,255,0.22)' }}>♠</div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      data-card-id={flipAttr}
      style={{
        background: 'linear-gradient(180deg, #faf9f5 0%, #ece8de 100%)',
        ...(isSelected ? { zIndex: Z_CARD_SELECTED } : {}),
        ...(isDimmed ? { filter: 'grayscale(1) brightness(0.55)' } : {}),
      }}
      className={`
        relative rounded-lg card-shadow select-none card-transition
        ${sizeClass}
        ${onClick ? 'cursor-pointer' : ''}
        ${isSelected
          ? 'ring-2 ring-[color:var(--accent)] -translate-y-2 sm:-translate-y-4 shadow-[0_6px_14px_rgba(111,176,255,0.45)]'
          : 'ring-1 ring-black/10'}
        ${isPlayable && !isSelected ? 'card-playable' : ''}
        flex flex-col justify-between p-1 sm:p-1.5
        ${className}
      `}
    >
      <div className={`${small ? 'text-xs' : 'text-[13px] sm:text-base'} ${colorClass} leading-none font-display`}>
        {label}<br />{symbol}
      </div>

      {!small && (
        <div className={`absolute inset-0 flex items-center justify-center ${colorClass} pointer-events-none`}>
          {card.rank >= 11 ? (
            <FaceArt rank={card.rank} className="h-[68%] w-auto" />
          ) : (
            <span className="text-2xl sm:text-3xl md:text-4xl">{symbol}</span>
          )}
        </div>
      )}

      <div className={`${small ? 'text-xs' : 'text-[13px] sm:text-base'} ${colorClass} leading-none self-end rotate-180 font-display`}>
        {label}<br />{symbol}
      </div>

      {isSelected && (
        <div className="absolute inset-0 rounded-lg pointer-events-none" style={{ background: 'rgba(111,176,255,0.12)' }} />
      )}
    </div>
  );
};
