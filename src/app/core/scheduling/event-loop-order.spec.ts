// Documentación ejecutable del orden del Event Loop en el que se apoya la app:
// las continuaciones de datos (Promise/async-await) son microtasks y los
// sondeos periódicos (setTimeout/interval de RxJS) son tasks.
describe('Event Loop: microtasks antes que tasks', () => {
  it('vacía toda la cola de microtasks antes de ejecutar la siguiente task', async () => {
    const order: string[] = [];

    setTimeout(() => order.push('task: setTimeout'), 0);
    Promise.resolve().then(() => order.push('microtask: then'));
    queueMicrotask(() => order.push('microtask: queueMicrotask'));
    order.push('call stack: síncrono');

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(order).toEqual([
      'call stack: síncrono',
      'microtask: then',
      'microtask: queueMicrotask',
      'task: setTimeout',
    ]);
  });

  it('una microtask encolada desde otra microtask también corre antes de la task pendiente', async () => {
    const order: string[] = [];

    setTimeout(() => order.push('task'), 0);
    Promise.resolve().then(() => {
      order.push('microtask 1');
      queueMicrotask(() => order.push('microtask 2 (encadenada)'));
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    // Por eso una cadena recursiva de microtasks congelaría la UI: la task
    // (y el pintado) no llega nunca mientras la cola de microtasks no se vacíe.
    expect(order).toEqual(['microtask 1', 'microtask 2 (encadenada)', 'task']);
  });
});
