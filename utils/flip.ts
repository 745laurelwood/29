import { flushSync } from 'react-dom';

const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
const DEFAULT_DURATION = 450;

const collectRects = (): Map<string, DOMRect> => {
  const rects = new Map<string, DOMRect>();
  document.querySelectorAll<HTMLElement>('[data-card-id]').forEach(el => {
    const id = el.dataset.cardId;
    if (!id || rects.has(id)) return;
    rects.set(id, el.getBoundingClientRect());
  });
  return rects;
};

/**
 * FLIP-based cross-browser transition. Captures positions of all [data-card-id]
 * elements, commits the React state change synchronously, then animates any
 * element that moved from its old rect to its new rect using the Web Animations API.
 */
export const flipTransition = (commit: () => void, duration = DEFAULT_DURATION): Promise<void> => {
  const before = collectRects();

  flushSync(commit);

  const animations: Animation[] = [];
  document.querySelectorAll<HTMLElement>('[data-card-id]').forEach(el => {
    const id = el.dataset.cardId;
    if (!id) return;
    const prev = before.get(id);
    if (!prev) return;
    const next = el.getBoundingClientRect();
    const dx = prev.left - next.left;
    const dy = prev.top - next.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 &&
        Math.abs(prev.width - next.width) < 0.5 &&
        Math.abs(prev.height - next.height) < 0.5) {
      return;
    }
    const sx = next.width > 0 ? prev.width / next.width : 1;
    const sy = next.height > 0 ? prev.height / next.height : 1;
    const anim = el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, transformOrigin: 'top left' },
        { transform: 'translate(0, 0) scale(1, 1)', transformOrigin: 'top left' },
      ],
      { duration, easing: EASING, fill: 'both' }
    );
    animations.push(anim);
  });

  if (animations.length === 0) return Promise.resolve();
  return Promise.all(animations.map(a => a.finished.catch(() => {}))).then(() => {});
};
