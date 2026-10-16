import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AiStatusService, AiStatusState } from '../../../../core/ai-status/ai-status.service';
import { PageScrollController } from '../../../../core/layout/page-scroll.controller';
import { SecurityChatSession } from '../security-chat-session.service';
import { SecurityChatPanel } from './security-chat-panel';

async function render(initial: AiStatusState) {
  const status = signal<AiStatusState>(initial);
  const isReady = signal(initial === 'ready');
  const session = {
    conversations: signal([]),
    currentConversationId: signal(null),
    messages: signal([]),
    isSending: signal(false),
    send: vi.fn(),
  };
  const pageScroll = { lockAtTop: vi.fn(), unlock: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: AiStatusService, useValue: { status, isReady } },
      { provide: SecurityChatSession, useValue: session },
      { provide: PageScrollController, useValue: pageScroll },
    ],
  });
  const fixture = TestBed.createComponent(SecurityChatPanel);
  const refresh = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await refresh();
  const element = fixture.nativeElement as HTMLElement;
  const input = element.querySelector<HTMLInputElement>('.chat-input-row input')!;
  const panel = element.querySelector<HTMLElement>('.chat-panel')!;
  const toggle = element.querySelector<HTMLButtonElement>('button[aria-controls="security-chat-panel"]')!;
  return { fixture, element, input, panel, toggle, status, isReady, session, pageScroll, refresh };
}

describe('SecurityChatPanel', () => {
  it('mientras la IA se enciende el chat queda deshabilitado con su aviso', async () => {
    const { element, input } = await render('warming_up');

    expect(input.disabled).toBe(true);
    expect(element.querySelector('.chat-ai-notice')?.textContent?.trim()).toBe(
      'user.securityAssistant.chat.aiNotReady.warming_up'
    );
  });

  it('si la IA no está disponible lo explica', async () => {
    const { element } = await render('unavailable');

    expect(element.querySelector('.chat-ai-notice')?.textContent?.trim()).toBe(
      'user.securityAssistant.chat.aiNotReady.unavailable'
    );
  });

  it('con la IA lista se habilita, sin aviso, y envía', async () => {
    const { element, input, status, isReady, session, refresh } = await render('warming_up');

    status.set('ready');
    isReady.set(true);
    await refresh();
    input.value = '¿mi red es segura?';
    input.dispatchEvent(new Event('input'));
    await refresh();
    element.querySelector<HTMLFormElement>('form.chat-input-row')!.dispatchEvent(new Event('submit'));

    expect(input.disabled).toBe(false);
    expect(element.querySelector('.chat-ai-notice')).toBeNull();
    expect(session.send).toHaveBeenCalledExactlyOnceWith('¿mi red es segura?');
  });

  it('minimizado se ve como siempre y el botón lo anuncia como ampliable', async () => {
    const { panel, toggle, pageScroll } = await render('ready');

    expect(panel.classList).not.toContain('chat-panel--expanded');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-label')).toBe('user.securityAssistant.chat.expand');
    expect(pageScroll.lockAtTop).not.toHaveBeenCalled();
  });

  it('al ampliar ocupa el área visible, bloquea el fondo y deja el foco en el campo de texto', async () => {
    const { panel, toggle, input, pageScroll, refresh } = await render('ready');

    toggle.click();
    await refresh();

    expect(panel.classList).toContain('chat-panel--expanded');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('user.securityAssistant.chat.collapse');
    expect(pageScroll.lockAtTop).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(input);
  });

  it('el mismo botón lo minimiza y libera el fondo', async () => {
    const { panel, toggle, pageScroll, refresh } = await render('ready');
    toggle.click();
    await refresh();

    toggle.click();
    await refresh();

    expect(panel.classList).not.toContain('chat-panel--expanded');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(pageScroll.unlock).toHaveBeenCalled();
  });

  it('Esc lo minimiza y el foco vuelve al campo de texto', async () => {
    const { panel, toggle, input, refresh } = await render('ready');
    toggle.click();
    await refresh();

    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await refresh();

    expect(panel.classList).not.toContain('chat-panel--expanded');
    expect(document.activeElement).toBe(input);
  });

  it('salir de la pantalla con el chat ampliado no deja la página bloqueada', async () => {
    const { fixture, toggle, pageScroll, refresh } = await render('ready');
    toggle.click();
    await refresh();
    pageScroll.unlock.mockClear();

    fixture.destroy();

    expect(pageScroll.unlock).toHaveBeenCalled();
  });

  it('ampliado mientras la IA enciende sigue deshabilitado con su aviso', async () => {
    const { element, toggle, input, refresh } = await render('warming_up');

    toggle.click();
    await refresh();

    expect(input.disabled).toBe(true);
    expect(element.querySelector('.chat-ai-notice')).not.toBeNull();
  });
});
