import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AiStatusService, AiStatusState } from '../../../core/ai-status/ai-status.service';
import { AiStatusIndicator } from './ai-status-indicator';

function render(initial: AiStatusState) {
  const status = signal<AiStatusState>(initial);
  const retry = vi.fn();
  const unavailableReason = signal('timed_out');
  const isTakingLong = signal(false);
  TestBed.configureTestingModule({
    providers: [{ provide: AiStatusService, useValue: { status, retry, unavailableReason, isTakingLong } }],
  });
  const fixture = TestBed.createComponent(AiStatusIndicator);
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const refresh = () => fixture.detectChanges();
  return { element, status, retry, refresh, isTakingLong };
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

  it('no disponible explica el motivo a lectores de pantalla y al pasar el puntero', () => {
    const { element } = render('unavailable');

    expect(element.querySelector('.visually-hidden')?.textContent?.trim()).toBe('common.aiStatus.reason.timed_out');
    expect(element.querySelector('.ai-status')?.getAttribute('title')).toBe('common.aiStatus.reason.timed_out');
  });

  it('si lleva rato encendiendo avisa que se puede seguir usando la app', () => {
    const { element, isTakingLong, refresh } = render('warming_up');
    expect(element.querySelector('.ai-status__slow')).toBeNull();

    isTakingLong.set(true);
    refresh();

    expect(element.querySelector('.ai-status__slow')?.textContent?.trim()).toBe('common.aiStatus.slowWarmUp');
    expect(element.querySelector('.ai-status')?.getAttribute('title')).toBe('common.aiStatus.slowWarmUp');
  });

  it('mientras enciende no muestra motivo', () => {
    const { element } = render('warming_up');

    expect(element.querySelector('.visually-hidden')).toBeNull();
    expect(element.querySelector('.ai-status')?.hasAttribute('title')).toBe(false);
  });
});
