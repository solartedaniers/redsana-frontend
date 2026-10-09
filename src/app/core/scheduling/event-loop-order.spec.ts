// Documento ejecutable del orden del Event Loop: los datos async son microtasks y los sondeos de RxJS son tasks.
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

    // Por eso una cadena infinita de microtasks congelaría la UI: la task y el pintado nunca llegarían.
    expect(order).toEqual(['microtask 1', 'microtask 2 (encadenada)', 'task']);
  });
});
