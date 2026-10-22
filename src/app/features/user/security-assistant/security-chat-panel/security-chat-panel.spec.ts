import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AiStatusService, AiStatusState } from '../../../../core/ai-status/ai-status.service';
import { PageScrollController } from '../../../../core/layout/page-scroll.controller';
import { ChatMessage } from '../../../../core/models/security.model';
import { SecurityChatSession } from '../security-chat-session.service';
import { ChatScrollAnchor } from './chat-scroll-anchor';
import { SecurityChatPanel } from './security-chat-panel';

async function render(initial: AiStatusState) {
  const status = signal<AiStatusState>(initial);
  const isReady = signal(initial === 'ready');
  // Como el servicio real: un "no disponible" sin motivo del backend cuenta como problema del servicio.
  const notReadyKey = computed(() => (status() === 'unavailable' ? 'service_error' : status()));
  const wakeUp = vi.fn();
  const session = {
    conversations: signal([]),
    currentConversationId: signal(null),
    messages: signal<ChatMessage[]>([]),
    isSending: signal(false),
    send: vi.fn(),
  };
  // Como el servicio real: la pregunta aparece enseguida y el chat queda esperando la respuesta.
  session.send.mockImplementation((text: string) => {
    session.messages.update((messages) => [...messages, { role: 'user', text }]);
    session.isSending.set(true);
  });
  const reply = (text: string) => {
    session.messages.update((messages) => [...messages, { role: 'assistant', text }]);
    session.isSending.set(false);
  };
  const scrollAnchor = { showAtTop: vi.fn(), bringIntoView: vi.fn() };
  const pageScroll = { lockAtTop: vi.fn(), unlock: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: AiStatusService, useValue: { status, isReady, notReadyKey, wakeUp } },
      { provide: SecurityChatSession, useValue: session },
      { provide: PageScrollController, useValue: pageScroll },
      { provide: ChatScrollAnchor, useValue: scrollAnchor },
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
  const list = element.querySelector<HTMLElement>('.chat-messages')!;
  const ask = async (text: string) => {
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await refresh();
    element.querySelector<HTMLFormElement>('form.chat-input-row')!.dispatchEvent(new Event('submit'));
    await refresh();
  };
  return { fixture, element, input, list, panel, toggle, status, isReady, wakeUp, session, pageScroll, scrollAnchor, reply, ask, refresh };
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
      'user.securityAssistant.chat.aiNotReady.service_error'
    );
  });

  it('abrir el chat pide despertar la IA', async () => {
    const { wakeUp } = await render('ready');

    expect(wakeUp).toHaveBeenCalledOnce();
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

  it('minimizado, al enviar trae el chat a la vista y deja la pregunta arriba de la lista', async () => {
    const { list, scrollAnchor, ask } = await render('ready');

    await ask('¿Mi red es segura?');

    expect(scrollAnchor.bringIntoView).toHaveBeenCalledExactlyOnceWith(list);
    const [anchoredList, question] = scrollAnchor.showAtTop.mock.lastCall!;
    expect(anchoredList).toBe(list);
    expect((question as HTMLElement).textContent?.trim()).toBe('¿Mi red es segura?');
  });

  it('al llegar una respuesta larga la pregunta sigue arriba: no salta al final', async () => {
    const { scrollAnchor, reply, ask, refresh } = await render('ready');
    await ask('¿Mi red es segura?');
    scrollAnchor.showAtTop.mockClear();

    reply('Respuesta larga '.repeat(200));
    await refresh();

    expect(scrollAnchor.showAtTop).toHaveBeenCalled();
    for (const [, item] of scrollAnchor.showAtTop.mock.calls) {
      expect((item as HTMLElement).classList).toContain('chat-bubble--user');
    }
  });

  it('después de la respuesta ya no mueve la lista', async () => {
    const { session, scrollAnchor, reply, ask, refresh } = await render('ready');
    await ask('hola');
    reply('respuesta');
    await refresh();
    scrollAnchor.showAtTop.mockClear();

    session.messages.update((messages) => [...messages, { role: 'assistant', text: 'otro aviso' }]);
    await refresh();

    expect(scrollAnchor.showAtTop).not.toHaveBeenCalled();
  });

  it('ampliado, al enviar no mueve la página: solo deja la pregunta arriba de la lista', async () => {
    const { toggle, scrollAnchor, ask, refresh } = await render('ready');
    toggle.click();
    await refresh();

    await ask('hola');

    expect(scrollAnchor.bringIntoView).not.toHaveBeenCalled();
    expect(scrollAnchor.showAtTop).toHaveBeenCalled();
  });

  it('al enviar con el botón el foco vuelve al campo de texto', async () => {
    const { element, input, refresh } = await render('ready');
    input.value = 'hola';
    input.dispatchEvent(new Event('input'));
    await refresh();
    const sendButton = element.querySelector<HTMLButtonElement>('.chat-input-row button[type=submit]')!;
    sendButton.focus();

    sendButton.click();
    await refresh();

    expect(document.activeElement).toBe(input);
  });

  it('al enviar el foco se queda en el campo de texto', async () => {
    const { input, ask } = await render('ready');
    input.focus();

    await ask('hola');

    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('');
  });
});
