import type { PointerEvent as ReactPointerEvent } from 'react';
import { playTapSound } from './audio';

/** Play tap sound on pointer down — call from every button's onPointerDown */
export function onButtonPointerDown(e: ReactPointerEvent) {
  if (e.button !== 0) return;
  playTapSound();
}
