import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AiStatusService, AiStatusState } from '../../../../core/ai-status/ai-status.service';
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
  TestBed.configureTestingModule({
    providers: [
      { provide: AiStatusService, useValue: { status, isReady } },
      { provide: SecurityChatSession, useValue: session },
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
  return { element, input, status, isReady, session, refresh };
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
});
