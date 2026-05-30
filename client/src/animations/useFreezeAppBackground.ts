import { useLayoutEffect } from 'react';

let openCount = 0;

const collectAnimatedElements = (): HTMLElement[] => {
  const root = document.getElementById('global-liquid-bg');
  if (!root) return [];
  const all: HTMLElement[] = [root];
  root.querySelectorAll<HTMLElement>('*').forEach(el => all.push(el));
  return all;
};

const freeze = () => {
  collectAnimatedElements().forEach(el => {
    // Stash whatever play-state was inline (usually empty), then force pause.
    if (!el.dataset.prevPlayState) {
      el.dataset.prevPlayState = el.style.animationPlayState || '__empty__';
    }
    el.style.animationPlayState = 'paused';
  });
  document.body.dataset.modalOpen = '1';
};

const thaw = () => {
  collectAnimatedElements().forEach(el => {
    const prev = el.dataset.prevPlayState;
    if (prev === '__empty__' || prev === undefined) {
      el.style.removeProperty('animation-play-state');
    } else {
      el.style.animationPlayState = prev;
    }
    delete el.dataset.prevPlayState;
  });
  delete document.body.dataset.modalOpen;
};

/**
 * While `active` is true, pauses the global animated background
 * (`#global-liquid-bg` and its children). The combination of a continuously
 * animating gradient under a `backdrop-filter` causes Chromium to re-rasterize
 * the blur every frame, producing a visible shimmer through the modal.
 *
 * Uses imperative inline style + `useLayoutEffect` so the pause takes effect
 * before the browser paints the modal — avoids the "first frame ripple" on
 * repeated open/close cycles. Refcounted across nested modals.
 */
export function useFreezeAppBackground(active: boolean): void {
  useLayoutEffect(() => {
    if (!active) return;
    if (openCount === 0) freeze();
    openCount += 1;
    return () => {
      openCount = Math.max(0, openCount - 1);
      if (openCount === 0) thaw();
    };
  }, [active]);
}
