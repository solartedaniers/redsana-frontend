import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ChatConversationSummary } from '../../../core/models/security.model';
import { SecurityAssistantRepository } from '../../../core/repositories/security-assistant.repository';
import { SecurityChatSession } from './security-chat-session.service';

const conversation = (id: string): ChatConversationSummary => ({ id, title: null, topic: null }) as ChatConversationSummary;

function setup(overrides: Partial<Record<keyof SecurityAssistantRepository, unknown>> = {}) {
  const repository = {
    listConversations: vi.fn(() => of([])),
    createConversation: vi.fn(() => of(conversation('new'))),
    getMessages: vi.fn(() => of([])),
    sendMessage: vi.fn(() => of({ reply: 'hola', noticeKey: null, noticeParams: null })),
    renameConversation: vi.fn(),
    startAssessmentBriefing: vi.fn(),
    ...overrides,
  };
  TestBed.configureTestingModule({
    providers: [
      SecurityChatSession,
      { provide: SecurityAssistantRepository, useValue: repository },
      { provide: I18nService, useValue: { language: signal('es') } },
    ],
  });
  return { session: TestBed.inject(SecurityChatSession), repository };
}

describe('SecurityChatSession', () => {
  it('el primer mensaje sin conversación activa crea una y envía en ella', () => {
    const { session, repository } = setup();

    session.send('¿Mi red es segura?');

    expect(repository.createConversation).toHaveBeenCalledOnce();
    expect(repository.sendMessage).toHaveBeenCalledWith('new', '¿Mi red es segura?');
    expect(session.messages().map((m) => m.role)).toEqual(['user', 'assistant']);
  });

  it('si el backend no guardó el mensaje (traía una contraseña) lo quita y muestra el aviso', () => {
    const { session } = setup({
      sendMessage: vi.fn(() => of({ reply: null, noticeKey: 'user.securityAssistant.chat.sensitiveRemoved', noticeParams: null })),
    });
    session.currentConversationId.set('c1');

    session.send('mi clave es 1234');

    expect(session.messages()).toEqual([
      { role: 'assistant', text: 'user.securityAssistant.chat.sensitiveRemoved', isTranslationKey: true, translationParams: undefined },
    ]);
  });

  it('si el envío falla muestra el error y libera el chat', () => {
    const { session } = setup({ sendMessage: vi.fn(() => throwError(() => new Error('502'))) });
    session.currentConversationId.set('c1');

    session.send('hola');

    expect(session.messages().at(-1)?.text).toBe('user.securityAssistant.chat.errorReply');
    expect(session.isSending()).toBe(false);
  });

  it('no envía mientras espera una respuesta', () => {
    const { session, repository } = setup();
    session.currentConversationId.set('c1');
    session.isSending.set(true);

    session.send('otra');

    expect(repository.sendMessage).not.toHaveBeenCalled();
  });

  it('el resumen de una evaluación abre su conversación sin duplicarla en la lista', () => {
    const briefing = conversation('b1');
    const { session } = setup({
      startAssessmentBriefing: vi.fn(() => of({ conversation: briefing, messages: [{ role: 'assistant', text: 'resumen' }] })),
    });
    session.conversations.set([briefing, conversation('old')]);

    session.startAssessmentBriefing('a1');

    expect(session.conversations().map((c) => c.id)).toEqual(['b1', 'old']);
    expect(session.currentConversationId()).toBe('b1');
    expect(session.messages()).toEqual([{ role: 'assistant', text: 'resumen' }]);
  });
});
