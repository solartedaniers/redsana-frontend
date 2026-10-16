import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AiStatusService } from '../../../core/ai-status/ai-status.service';
import { AiWarmingUpError } from '../../../core/ai-status/ai-warming-up.error';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ChatConversationSummary } from '../../../core/models/security.model';
import { SecurityAssistantRepository } from '../../../core/repositories/security-assistant.repository';
import { SecurityChatSession } from './security-chat-session.service';

const conversation = (id: string): ChatConversationSummary => ({ id, title: null, topic: null }) as ChatConversationSummary;

function setup(overrides: Partial<Record<keyof SecurityAssistantRepository, unknown>> = {}, aiReady = true) {
  const aiStatus = { isReady: signal(aiReady), reportWarmingUp: vi.fn() };
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
      { provide: AiStatusService, useValue: aiStatus },
    ],
  });
  return { session: TestBed.inject(SecurityChatSession), repository, aiStatus };
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

  it('si la IA estaba encendiendo avisa que espere y la despierta otra vez, sin mostrarlo como fallo', () => {
    const { session, aiStatus } = setup({ sendMessage: vi.fn(() => throwError(() => new AiWarmingUpError())) });
    session.currentConversationId.set('c1');

    session.send('hola');

    expect(session.messages().at(-1)?.text).toBe('user.securityAssistant.chat.aiWarmingUpReply');
    expect(aiStatus.reportWarmingUp).toHaveBeenCalledOnce();
    expect(session.isSending()).toBe(false);
  });

  it('el resumen espera a que la IA esté lista antes de pedirse', () => {
    const startAssessmentBriefing = vi.fn(() => of({ conversation: conversation('b1'), messages: [] }));
    const { session, aiStatus } = setup({ startAssessmentBriefing }, false);

    session.startAssessmentBriefing('a1');
    TestBed.tick();
    expect(startAssessmentBriefing).not.toHaveBeenCalled();
    expect(session.isSending()).toBe(false);

    aiStatus.isReady.set(true);
    TestBed.tick();

    expect(startAssessmentBriefing).toHaveBeenCalledExactlyOnceWith('a1', 'es');
    expect(session.currentConversationId()).toBe('b1');
  });

  it('si la IA se durmió al pedir el resumen, lo vuelve a pedir cuando despierta', () => {
    const startAssessmentBriefing = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new AiWarmingUpError()))
      .mockReturnValueOnce(of({ conversation: conversation('b1'), messages: [] }));
    const { session, aiStatus } = setup({ startAssessmentBriefing });
    aiStatus.reportWarmingUp.mockImplementation(() => aiStatus.isReady.set(false));

    session.startAssessmentBriefing('a1');
    TestBed.tick();
    expect(startAssessmentBriefing).toHaveBeenCalledOnce();

    aiStatus.isReady.set(true);
    TestBed.tick();

    expect(startAssessmentBriefing).toHaveBeenCalledTimes(2);
    expect(session.currentConversationId()).toBe('b1');
  });
});
