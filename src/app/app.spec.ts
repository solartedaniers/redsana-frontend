import { TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';
import { NEVER } from 'rxjs';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: SwUpdate, useValue: { isEnabled: false, versionUpdates: NEVER } }],
    })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  // Reemplaza la prueba de la plantilla inicial de Angular, que ya no existe.
  it('renderiza el contenedor de rutas y no avisa de versión nueva sin Service Worker', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
    expect(compiled.querySelector('.update-banner')).toBeNull();
  });
});
