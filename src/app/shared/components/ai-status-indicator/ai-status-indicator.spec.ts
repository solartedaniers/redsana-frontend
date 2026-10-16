import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AiStatusService, AiStatusState } from '../../../core/ai-status/ai-status.service';
import { AiStatusIndicator } from './ai-status-indicator';

function render(initial: AiStatusState) {
  const status = signal<AiStatusState>(initial);
  const retry = vi.fn();
  TestBed.configureTestingModule({ providers: [{ provide: AiStatusService, useValue: { status, retry } }] });
  const fixture = TestBed.createComponent(AiStatusIndicator);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const refresh = () => fixture.detectChanges();
  return { element, status, retry, refresh };
}

describe('AiStatusIndicator', () => {
  it('sin sesión no muestra nada', () => {
    const { element } = render('idle');

    expect(element.textContent?.trim()).toBe('');
  });

  it('muestra "encendiendo" con tono de advertencia y sin botón', () => {
    const { element } = render('warming_up');

    const sticker = element.querySelector('.sticker')!;
    expect(sticker.textContent?.trim()).toBe('common.aiStatus.warming_up');
    expect(sticker.getAttribute('data-tone')).toBe('warning');
    expect(element.querySelector('button')).toBeNull();
    expect(element.querySelector('[role="status"]')).not.toBeNull();
  });

  it('pasa a "lista" con tono saludable cuando la IA despierta', () => {
    const { element, status, refresh } = render('warming_up');

    status.set('ready');
    refresh();

    const sticker = element.querySelector('.sticker')!;
    expect(sticker.textContent?.trim()).toBe('common.aiStatus.ready');
    expect(sticker.getAttribute('data-tone')).toBe('healthy');
  });

  it('no disponible ofrece reintentar', () => {
    const { element, retry } = render('unavailable');

    expect(element.querySelector('.sticker')?.getAttribute('data-tone')).toBe('critical');
    element.querySelector<HTMLButtonElement>('button')!.click();

    expect(retry).toHaveBeenCalledOnce();
  });
});
