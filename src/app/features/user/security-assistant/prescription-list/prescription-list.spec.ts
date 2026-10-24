import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { PrescriptionList } from './prescription-list';

const PREFIX = 'user.securityAssistant.recommendations.changeDefaultPassword';

describe('PrescriptionList', () => {
  it('debajo de cada recomendación muestra cómo hacerlo', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: I18nService, useValue: { translate: (key: string) => key, language: signal('es') } }],
    });
    const fixture = TestBed.createComponent(PrescriptionList);
    fixture.componentRef.setInput('recommendations', [
      {
        id: 'change-default-password',
        titleKey: `${PREFIX}.title`,
        descriptionKey: `${PREFIX}.description`,
        howKey: `${PREFIX}.how`,
        priority: 1,
      },
    ]);
    fixture.detectChanges();

    const how = (fixture.nativeElement as HTMLElement).querySelector('.dose__how')?.textContent?.replace(/\s+/g, ' ');
    expect(how?.trim()).toBe(`user.securityAssistant.howLabel ${PREFIX}.how`);
  });
});
