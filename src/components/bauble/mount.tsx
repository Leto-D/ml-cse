/**
 * Point de montage React de la scène 3D.
 *
 * Ce module n'est jamais importé statiquement : `scripts/bauble.ts` le tire par
 * `import()` une fois ses trois gardes passées. C'est cette frontière qui fait
 * que React, three et la scène ne sont demandés que si la scène va exister.
 */
import { Component } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import BaubleCanvas from './BaubleCanvas';
import type { BaubleProps } from './BaubleCanvas';

export type MountOptions = BaubleProps & {
  /** Contexte WebGL perdu, scène en échec : on rend la main au repli statique. */
  onFail: () => void;
};

/**
 * Un échec à l'intérieur du canevas ne doit pas casser la page. On rend `null`
 * et on prévient l'appelant, qui restaure le repli. Aucun message visible.
 */
class Quiet extends Component<
  { children: ReactNode; onFail: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function mountBauble(host: HTMLElement, { onFail, ...props }: MountOptions) {
  const root = createRoot(host);
  root.render(
    <Quiet onFail={onFail}>
      <BaubleCanvas {...props} />
    </Quiet>,
  );
  return () => root.unmount();
}
