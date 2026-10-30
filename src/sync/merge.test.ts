import { mergeRecords, stripLocalOnly } from './merge';

describe('per-field LWW merge', () => {
  const base = { id: '1', updatedAt: 100, deviceId: 'a', name: 'x', kg: 80, fieldTs: { name: 100, kg: 100 } };

  it('takes the newer value per field', () => {
    const a = { ...base, name: 'local', updatedAt: 200, fieldTs: { name: 200, kg: 100 } };
    const b = { ...base, deviceId: 'b', kg: 79, updatedAt: 150, fieldTs: { name: 100, kg: 150 } };
    const m = mergeRecords(a, b);
    expect(m.name).toBe('local');
    expect(m.kg).toBe(79);
    expect(m.updatedAt).toBe(200);
  });

  it('breaks ties by deviceId and is commutative', () => {
    const a = { ...base, kg: 1, deviceId: 'a' };
    const b = { ...base, kg: 2, deviceId: 'b' };
    expect(mergeRecords(a, b).kg).toBe(2);
    expect(mergeRecords(b, a).kg).toBe(2);
  });

  it('propagates soft deletes', () => {
    const a = { ...base, deletedAt: null as number | null, fieldTs: { ...base.fieldTs, deletedAt: 100 } };
    const b = { ...base, deviceId: 'b', deletedAt: 300 as number | null, updatedAt: 300, fieldTs: { ...base.fieldTs, deletedAt: 300 } };
    expect(mergeRecords(a, b).deletedAt).toBe(300);
  });

  it('never uploads local-only photos and keeps them on merge', () => {
    const local = { ...base, photo: 'data:image/webp;base64,xx', fieldTs: { ...base.fieldTs, photo: 100 } };
    const remote = { ...base, deviceId: 'b', updatedAt: 500, kg: 70, fieldTs: { name: 500, kg: 500 } };
    expect(stripLocalOnly(local).photo).toBeUndefined();
    const m = mergeRecords<Record<string, unknown> & typeof base>(local, remote);
    expect(m.photo).toBe(local.photo);
    expect(m.kg).toBe(70);
  });
});
