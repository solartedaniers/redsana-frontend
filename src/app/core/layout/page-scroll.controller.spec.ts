import { TestBed } from '@angular/core/testing';
import { PageScrollController } from './page-scroll.controller';

describe('PageScrollController', () => {
  let controller: PageScrollController;
  const root = () => document.documentElement;

  beforeEach(() => {
    root().style.overflow = 'auto';
    controller = TestBed.inject(PageScrollController);
  });

  afterEach(() => controller.unlock());

  it('lleva la página arriba y bloquea su scroll', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

    controller.lockAtTop();

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0 });
    expect(root().style.overflow).toBe('hidden');
    expect(controller.isLocked).toBe(true);
  });

  it('al desbloquear restaura el overflow que había', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    controller.lockAtTop();

    controller.unlock();

    expect(root().style.overflow).toBe('auto');
    expect(controller.isLocked).toBe(false);
  });

  it('bloquear dos veces no pierde el valor original', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    controller.lockAtTop();
    controller.lockAtTop();

    controller.unlock();

    expect(root().style.overflow).toBe('auto');
  });
});
