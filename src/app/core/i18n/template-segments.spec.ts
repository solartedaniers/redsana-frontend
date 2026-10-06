import { splitTemplate } from './template-segments';

describe('splitTemplate', () => {
  it('separa el texto fijo de los valores interpolados, sin perder ni cambiar texto', () => {
    const segments = splitTemplate('Escribe {{primary}} como DNS primario y {{secondary}} como DNS secundario.', {
      primary: '1.1.1.3',
      secondary: '1.0.0.3',
    });

    expect(segments).toEqual([
      { text: 'Escribe ', isValue: false },
      { text: '1.1.1.3', isValue: true },
      { text: ' como DNS primario y ', isValue: false },
      { text: '1.0.0.3', isValue: true },
      { text: ' como DNS secundario.', isValue: false },
    ]);
    expect(segments.map((s) => s.text).join('')).toBe('Escribe 1.1.1.3 como DNS primario y 1.0.0.3 como DNS secundario.');
  });

  it('un texto sin placeholders queda como un solo trozo', () => {
    expect(splitTemplate('Guarda los cambios.', {})).toEqual([{ text: 'Guarda los cambios.', isValue: false }]);
  });

  it('un placeholder sin valor no se inventa: queda como texto', () => {
    expect(splitTemplate('Usa {{missing}}.', {})).toEqual([{ text: 'Usa {{missing}}.', isValue: false }]);
  });
});
