// Money stays in integer pence in JavaScript; SQL literals are exact DECIMAL values.
export const SEED = 20260101;
export const categories = ['Salary', 'Housing', 'Groceries', 'Utilities', 'Transport', 'Subscriptions', 'Restaurants', 'Entertainment', 'Transfers', 'Refunds', 'Fees', 'Shopping'] as const;
export const accounts = [
  { id: 1, name: 'Everyday current', type: 'current' },
  { id: 2, name: 'Joint current', type: 'current' },
  { id: 3, name: 'Rainy day savings', type: 'savings' },
  { id: 4, name: 'Everyday credit card', type: 'credit_card' },
];
export const payees = [
  { id: 1, name: 'Northstar Studio', categoryId: 1 }, { id: 2, name: 'Home Mortgage', categoryId: 2 },
  { id: 3, name: 'Fresh Market', categoryId: 3 }, { id: 4, name: 'Green Energy', categoryId: 4 },
  { id: 5, name: 'City Transport', categoryId: 5 }, { id: 6, name: 'Stream & Sound', categoryId: 6 },
  { id: 7, name: 'The Corner Kitchen', categoryId: 7 }, { id: 8, name: 'Picture House', categoryId: 8 },
  { id: 9, name: 'Own account transfer', categoryId: 9 }, { id: 10, name: 'Retail refund', categoryId: 10 },
  { id: 11, name: 'Account service fee', categoryId: 11 }, { id: 12, name: 'Harbour Electronics', categoryId: 12 },
];
export interface Transaction {
  id: number; date: string; accountId: number; payeeId: number; payee: string;
  categoryId: number | null; category: string | null; pence: number; description: string;
  transferId: number | null; duplicateOf: number | null;
}
function random(seed: number) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
export function money(pence: number): string {
  return `${pence < 0 ? '-' : ''}${Math.floor(Math.abs(pence) / 100)}.${String(Math.abs(pence) % 100).padStart(2, '0')}`;
}
export function generateTransactions(seed = SEED): Transaction[] {
  const rng = random(seed);
  const rows: Transaction[] = [];
  const add = (date: string, accountId: number, payeeId: number, pence: number, extras: Partial<Transaction> = {}) => {
    const payee = payees[payeeId - 1];
    rows.push({ id: rows.length + 1, date, accountId, payeeId, payee: payee.name,
      categoryId: payee.categoryId, category: categories[payee.categoryId - 1], pence,
      description: 'Card purchase', transferId: null, duplicateOf: null, ...extras });
  };
  // Fixed monthly commitments and genuine paired transfers over two full years.
  for (let month = 0; month < 24; month++) {
    const year = 2024 + Math.floor(month / 12), mm = String(month % 12 + 1).padStart(2, '0');
    const date = `${year}-${mm}-01`;
    add(date, 1, 1, 420000, { description: 'Monthly salary' });
    add(date, 2, 1, 420000, { description: 'Joint household salary' });
    add(date, 1, 2, -145000, { description: 'Monthly mortgage' });
    add(date, 2, 4, -13500, { description: 'Energy direct debit' });
    add(date, 1, 6, -1599, { description: 'Monthly subscription' });
    add(date, 1, 11, -500, { description: 'Service fee' });
    add(date, 1, 9, -50000, { transferId: month + 1, description: 'Transfer to savings' });
    add(date, 3, 9, 50000, { transferId: month + 1, description: 'Transfer from current' });
    add(date, 1, 9, -50000, { transferId: month + 25, description: 'Credit card repayment' });
    add(date, 4, 9, 50000, { transferId: month + 25, description: 'Credit card payment received' });
  }
  // Controlled boundary cases make negative-money comparisons teachable.
  for (const pence of [-3000, -3001, -5000, -10000, -10001, -4999]) add('2024-01-02', 1, 3, pence);
  add('2024-08-12', 4, 12, -249999, { description: 'Unusually large laptop purchase' });
  add('2025-03-09', 4, 12, -179999, { description: 'Unusually large equipment purchase' });
  add('2025-12-18', 2, 7, -125001, { description: 'Unusually large celebration' });
  const spendPayees = [3, 3, 3, 5, 5, 7, 7, 8, 12];
  while (rows.length < 10000) {
    const day = Math.floor(rng() * 731);
    const date = new Date(Date.UTC(2024, 0, 1) + day * 86400000).toISOString().slice(0, 10);
    const accountId = [1, 2, 4][Math.floor(rng() * 3)];
    const payeeId = spendPayees[Math.floor(rng() * spendPayees.length)];
    const largePurchase = rng() < 0.1;
    const pence = -(150 + Math.floor(rng() * (largePurchase ? 14850 : 1050)));
    if (rows.length % 137 === 0) add(date, accountId, 10, -pence, { description: 'Returned purchase' });
    else if (rows.length % 251 === 0) {
      const previous = rows[rows.length - 1];
      add(previous.date, previous.accountId, previous.payeeId, previous.pence, { payee: previous.payee, categoryId: previous.categoryId, category: previous.category, description: previous.description, duplicateOf: previous.id });
    } else add(date, accountId, payeeId, pence, rows.length % 211 === 0
      ? { categoryId: null, category: null, description: 'Uncategorised purchase' }
      : rows.length % 173 === 0 ? { payee: '  fresh MARKET  ' } : {});
  }
  return rows;
}
const quote = (v: string) => `'${v.replaceAll("'", "''")}'`;
const nullable = (v: number | null) => v === null ? 'NULL' : String(v);
export const schemaSQL = `
CREATE TABLE accounts (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, account_type VARCHAR NOT NULL, currency VARCHAR NOT NULL CHECK(currency = 'GBP'));
CREATE TABLE categories (id INTEGER PRIMARY KEY, name VARCHAR UNIQUE NOT NULL);
CREATE TABLE payees (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, default_category_id INTEGER REFERENCES categories(id));
CREATE TABLE transactions (
 id INTEGER PRIMARY KEY, date DATE NOT NULL, account_id INTEGER NOT NULL REFERENCES accounts(id),
 payee_id INTEGER NOT NULL REFERENCES payees(id), payee VARCHAR NOT NULL,
 category_id INTEGER REFERENCES categories(id), category VARCHAR,
 amount DECIMAL(12,2) NOT NULL, description VARCHAR NOT NULL, transfer_id INTEGER, duplicate_of INTEGER
);
CREATE TABLE budgets (id INTEGER PRIMARY KEY, month DATE NOT NULL, category_id INTEGER NOT NULL REFERENCES categories(id), amount DECIMAL(12,2) NOT NULL CHECK(amount >= 0));`;
export function seedStatements(seed = SEED): string[] {
  const statements = [schemaSQL,
    `INSERT INTO accounts VALUES ${accounts.map(a => `(${a.id},${quote(a.name)},${quote(a.type)},'GBP')`).join(',')};`,
    `INSERT INTO categories VALUES ${categories.map((c, i) => `(${i + 1},${quote(c)})`).join(',')};`,
    `INSERT INTO payees VALUES ${payees.map(p => `(${p.id},${quote(p.name)},${p.categoryId})`).join(',')};`,
  ];
  const rows = generateTransactions(seed);
  for (let i = 0; i < rows.length; i += 500) {
    statements.push(`INSERT INTO transactions VALUES ${rows.slice(i, i + 500).map(t => `(${t.id},${quote(t.date)},${t.accountId},${t.payeeId},${quote(t.payee)},${nullable(t.categoryId)},${t.category === null ? 'NULL' : quote(t.category)},${money(t.pence)},${quote(t.description)},${nullable(t.transferId)},${nullable(t.duplicateOf)})`).join(',')};`);
  }
  const budgets: string[] = [];
  for (let month = 0; month < 24; month++) {
    const date = `${2024 + Math.floor(month / 12)}-${String(month % 12 + 1).padStart(2, '0')}-01`;
    for (const categoryId of [3, 4, 5, 7, 8, 12]) budgets.push(`(${budgets.length + 1},'${date}',${categoryId},${categoryId === 3 ? '800.00' : '400.00'})`);
  }
  statements.push(`INSERT INTO budgets VALUES ${budgets.join(',')};`);
  return statements;
}
export function nativeSeedSQL(): string {
  return `-- SQL Academy v0.1; seed ${SEED}; fictional data, 2024–2025.\n-- Negative = outflow, positive = inflow. Use an empty training database.\nBEGIN TRANSACTION;\n${seedStatements().join('\n')}\nCOMMIT;\n`;
}
