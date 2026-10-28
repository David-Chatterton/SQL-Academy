import { accounts, categories, payees, type Transaction } from '../data/finance';
export type JoinRelationship = 'account' | 'payee' | 'category';
export interface LookupRow { id: number; name: string }
export interface JoinPreviewRow {
  transactionId: number | null; foreignKey: number | null; lookupId: number | null;
  lookupName: string | null; pence: number | null;
}
export const joinRelationships = {
  account: { label: 'Accounts', table: 'accounts', column: 'account_id', lookup: accounts as readonly LookupRow[] },
  payee: { label: 'Payees', table: 'payees', column: 'payee_id', lookup: payees as readonly LookupRow[] },
  category: { label: 'Categories', table: 'categories', column: 'category_id', lookup: categories.map((name, index) => ({ id: index + 1, name })) as readonly LookupRow[] },
};
export function foreignKey(row: Transaction, relationship: JoinRelationship): number | null {
  return relationship === 'account' ? row.accountId : relationship === 'payee' ? row.payeeId : row.categoryId;
}
// A labelled sample demonstration only. Learner SQL is always executed by DuckDB.
export function previewJoin(sample: readonly Transaction[], options: {
  relationship: JoinRelationship; kind: 'INNER' | 'LEFT'; direction: 'transactions' | 'lookup';
  outflowsOnly: boolean; placement: 'ON' | 'WHERE';
}): JoinPreviewRow[] {
  const { relationship, kind, direction, outflowsOnly, placement } = options;
  const lookup = joinRelationships[relationship].lookup;
  const rows: JoinPreviewRow[] = [];
  const includeMatch = (transaction: Transaction) => !outflowsOnly || placement !== 'ON' || transaction.pence < 0;
  const append = (transaction: Transaction | null, parent: LookupRow | null) => rows.push({
    transactionId: transaction?.id ?? null, foreignKey: transaction ? foreignKey(transaction, relationship) : null,
    lookupId: parent?.id ?? null, lookupName: parent?.name ?? null, pence: transaction?.pence ?? null,
  });
  if (direction === 'transactions') {
    for (const transaction of sample) {
      const matches = lookup.filter(parent => parent.id === foreignKey(transaction, relationship) && includeMatch(transaction));
      for (const parent of matches) append(transaction, parent);
      if (!matches.length && kind === 'LEFT') append(transaction, null);
    }
  } else {
    for (const parent of lookup) {
      const matches = sample.filter(transaction => foreignKey(transaction, relationship) === parent.id && includeMatch(transaction));
      for (const transaction of matches) append(transaction, parent);
      if (!matches.length && kind === 'LEFT') append(null, parent);
    }
  }
  return rows.filter(row => !outflowsOnly || placement !== 'WHERE' || (row.pence !== null && row.pence < 0));
}
