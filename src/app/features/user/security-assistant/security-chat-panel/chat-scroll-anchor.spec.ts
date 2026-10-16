import { TestBed } from '@angular/core/testing';
import { ChatScrollAnchor } from './chat-scroll-anchor';

function element(offsetTop = 0): HTMLElement {
  const node = document.createElement('div');
  Object.defineProperty(node, 'offsetTop', { value: offsetTop });
  node.scrollTo = vi.fn();
  node.scrollIntoView = vi.fn();
  return node;
}

function setReducedMotion(reduced: boolean): void {
  // jsdom no implementa matchMedia: la defino con la respuesta que necesita cada caso.
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: reduced }) });
}

describe('ChatScrollAnchor', () => {
  it('deja el mensaje arriba de la lista descontando su padding, sin mover la página', () => {
    setReducedMotion(false);
    const list = element();
    list.style.paddingTop = '16px';
    const question = element(240);
    const pageScroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

    TestBed.inject(ChatScrollAnchor).showAtTop(list, question);

    expect(list.scrollTo).toHaveBeenCalledWith({ top: 224, behavior: 'smooth' });
    expect(question.scrollIntoView).not.toHaveBeenCalled();
    expect(pageScroll).not.toHaveBeenCalled();
  });

  it('nunca pide un desplazamiento negativo', () => {
    setReducedMotion(false);
    const list = element();
    list.style.paddingTop = '16px';

    TestBed.inject(ChatScrollAnchor).showAtTop(list, element(4));

    expect(list.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('trae el chat a la vista', () => {
    setReducedMotion(false);
    const panel = element();

    TestBed.inject(ChatScrollAnchor).bringIntoView(panel);

    expect(panel.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
  });

  it('con movimiento reducido no anima el desplazamiento', () => {
    setReducedMotion(true);
    const panel = element();

    TestBed.inject(ChatScrollAnchor).bringIntoView(panel);

    expect(panel.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'auto' });
  });
});
