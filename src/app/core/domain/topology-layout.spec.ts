import { layoutTopologyNodes } from './topology-layout';

const key = ({ xRem, yRem }: { xRem: number; yRem: number }) => `${xRem.toFixed(3)},${yRem.toFixed(3)}`;

describe('layoutTopologyNodes', () => {
  it('devuelve exactamente un punto por dispositivo, todos en posiciones distintas', () => {
    for (const count of [0, 1, 3, 20, 31, 32, 75]) {
      const offsets = layoutTopologyNodes(count);
      expect(offsets).toHaveLength(count);
      expect(new Set(offsets.map(key)).size).toBe(count);
    }
  });

  it('ningún par de puntos queda encimado', () => {
    const offsets = layoutTopologyNodes(60);
    for (let i = 0; i < offsets.length; i++) {
      for (let j = i + 1; j < offsets.length; j++) {
        const distance = Math.hypot(offsets[i].xRem - offsets[j].xRem, offsets[i].yRem - offsets[j].yRem);
        expect(distance).toBeGreaterThanOrEqual(1.69);
      }
    }
  });

  it('ningún punto queda debajo del hub central', () => {
    expect(layoutTopologyNodes(40).every(({ xRem, yRem }) => Math.hypot(xRem, yRem) >= 8.5 - 1e-9)).toBe(true);
  });
});
