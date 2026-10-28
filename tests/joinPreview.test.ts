import { describe, expect, it } from 'vitest';
import { generateTransactions } from '../src/data/finance';
import { previewJoin } from '../src/engine/joinPreview';
const all = generateTransactions();
const sample = [all[0], all.find(row => row.category === 'Groceries')!, all.find(row => row.categoryId === null)!];
const options = { relationship: 'category', kind: 'LEFT', direction: 'transactions', outflowsOnly: false, placement: 'ON' } as const;
describe('seeded relational teaching preview', () => {
  it('preserves a NULL foreign key with LEFT JOIN and removes it with INNER JOIN', () => {
    const left = previewJoin(sample, options);
    expect(left).toHaveLength(3);
    expect(left[2]).toMatchObject({ transactionId: sample[2].id, foreignKey: null, lookupId: null, lookupName: null });
    const inner = previewJoin(sample, { ...options, kind: 'INNER' });
    expect(inner).toHaveLength(2);
    expect(inner.map(row => row.transactionId)).toEqual(sample.slice(0, 2).map(row => row.id));
  });
  it('demonstrates ON versus WHERE when the lookup is preserved', () => {
    const on = previewJoin(sample, { ...options, direction: 'lookup', outflowsOnly: true });
    expect(on).toHaveLength(12);
    expect(on.find(row => row.lookupName === 'Salary')).toMatchObject({ transactionId: null, pence: null });
    const where = previewJoin(sample, { ...options, direction: 'lookup', outflowsOnly: true, placement: 'WHERE' });
    expect(where).toHaveLength(1);
    expect(where[0].lookupName).toBe('Groceries');
  });
  it('preserves accounts with no sample matches and repeats parent details for several children', () => {
    const rows = previewJoin(sample, { ...options, relationship: 'account', direction: 'lookup' });
    expect(rows.filter(row => row.lookupId === 3)).toEqual([{ transactionId: null, foreignKey: null, lookupId: 3, lookupName: 'Rainy day savings', pence: null }]);
    expect(rows.filter(row => row.transactionId !== null)).toHaveLength(sample.length);
    expect(rows.filter(row => row.lookupId === 1).length).toBeGreaterThan(1);
  });
});
