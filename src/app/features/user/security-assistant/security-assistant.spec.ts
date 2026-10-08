import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { NEVER, of } from 'rxjs';
import { NetworkMetricsRepository } from '../../../core/repositories/network-metrics.repository';
import { SecurityAssistantRepository } from '../../../core/repositories/security-assistant.repository';
import { SecurityEvidenceCollector } from '../../../core/security-evidence/security-evidence.collector';
import { WifiEncryptionGateway } from '../../../core/wifi-encryption/wifi-encryption.gateway';
import { SecurityAssistant } from './security-assistant';

function render(queryParams: Record<string, string> = {}, networkStatus: 'good' | 'warning' = 'warning') {
  const repository = {
    getQuestionnaire: () => of([]),
    getLatest: () => of(null),
    listConversations: vi.fn(() => of([])),
    createConversation: vi.fn(() => of({ id: 'family', title: null, topic: 'family_mode' })),
    getMessages: () => of([]),
    startAssessmentBriefing: vi.fn(() => NEVER),
  };
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } } },
      { provide: SecurityAssistantRepository, useValue: repository },
      { provide: NetworkMetricsRepository, useValue: { getSnapshot: () => of({ status: networkStatus }) } },
      { provide: WifiEncryptionGateway, useValue: { isAvailable: false, detect: () => Promise.resolve(null) } },
      { provide: SecurityEvidenceCollector, useValue: { collect: () => Promise.resolve({}) } },
    ],
  });
  const fixture = TestBed.createComponent(SecurityAssistant);
  fixture.detectChanges();
  return { fixture, repository, element: fixture.nativeElement as HTMLElement };
}

describe('SecurityAssistant', () => {
  it('muestra el panel de evaluación y el de chat', () => {
    const { element } = render();

    expect(element.querySelector('app-security-assessment-panel')).not.toBeNull();
    expect(element.querySelector('app-security-chat-panel .chat-panel')).not.toBeNull();
  });

  it('abierto desde Modo familiar, inicia una conversación de ese tema', () => {
    const { repository, element } = render({ topic: 'family_mode' });

    expect(repository.createConversation).toHaveBeenCalledExactlyOnceWith('family_mode');
    expect(element.querySelector('.chat-bubble')?.textContent?.trim()).toBe('user.securityAssistant.chat.familyModeIntro');
  });

  it('una evaluación nueva pide su resumen en el chat', () => {
    const { fixture, repository } = render();

    fixture.debugElement.query((el) => el.name === 'app-security-assessment-panel').triggerEventHandler('assessed', 'a1');

    expect(repository.startAssessmentBriefing).toHaveBeenCalledWith('a1', expect.any(String));
  });
});

describe('SecurityAssistant badge de red', () => {
  it('muestra el estado de la última medición, no "Red saludable" fijo', () => {
    const { element } = render({}, 'warning');

    expect(element.querySelector('.assistant-hero .status-badge')?.textContent?.trim()).toBe('common.networkStatus.warning');
  });
});
