import { test, expect, type Page } from '@playwright/test';
import { lessons } from '../../src/content/lessons';
async function ready(page: Page) { await expect(page.getByText('DuckDB ready', { exact: true })).toBeVisible(); }
async function plainEditor(page: Page) {
  const toggle = page.getByRole('button', { name: 'Use plain text editor', exact: true });
  if (await toggle.isVisible()) await toggle.click();
  return page.getByRole('textbox', { name: 'SQL query editor', exact: true });
}
async function run(page: Page, sql: string) {
  await (await plainEditor(page)).fill(sql);
  await page.getByRole('button', { name: 'Run Query', exact: true }).click();
}
test('all sixteen reference solutions execute in real DuckDB and save completion', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await ready(page);
  for (const lesson of lessons) {
    await page.getByRole('navigation', { name: `Module ${lesson.module} lessons` }).getByRole('button', { name: new RegExp(lesson.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).click();
    const answer = page.locator('#complete-answer');
    await expect(answer).toBeHidden();
    await page.getByRole('button', { name: 'Reveal solution', exact: true }).click();
    await expect(answer.locator('pre code')).toHaveText(lesson.solution);
    await page.getByRole('button', { name: 'Hide solution', exact: true }).click();
    await expect(answer).toBeHidden();
    await run(page, lesson.solution);
    await expect(page.getByText('Correct — your actual DuckDB results match the task. Lesson completed.', { exact: true })).toBeVisible();
  }
  await page.reload(); await ready(page);
  await expect(page.getByText('16 of 16 lessons completed', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Learning dashboard', exact: true }).click();
  await expect(page.getByText('100%', { exact: true }).first()).toBeVisible();
  expect(errors).toEqual([]);
});
test('wrong results, destructive statements and SQL errors cannot complete a lesson', async ({ page }) => {
  await page.goto('/'); await ready(page);
  await run(page, 'SELECT * FROM transactions LIMIT 1;');
  await expect(page.getByText(/Your query returned 1 rows/)).toBeVisible();
  await expect(page.getByText('0 of 16 lessons completed', { exact: true })).toBeVisible();
  await run(page, 'DELETE FROM transactions;');
  await expect(page.getByRole('alert', { name: 'SQL query error', exact: true })).toContainText('read-only');
  await run(page, 'SELECT missing_column FROM transactions;');
  await expect(page.getByRole('alert', { name: 'SQL query error', exact: true })).toContainText('missing_column');
  await run(page, lessons[0].solution);
  await expect(page.getByText('10,000 rows', { exact: true })).toBeVisible();
  await expect(page.getByText(/Correct —/)).toBeVisible();
  await page.getByRole('button', { name: 'Reset database', exact: true }).click();
  await ready(page);
  await run(page, lessons[0].solution);
  await expect(page.getByText('10,000 rows', { exact: true })).toBeVisible();
  await expect(page.getByText('1 of 16 lessons completed', { exact: true })).toBeVisible();
});
test('alternative range SQL is accepted and boundaries are exact', async ({ page }) => {
  await page.goto('/'); await ready(page);
  await page.getByRole('navigation', { name: 'Module 1 lessons' }).getByRole('button', { name: /Comparison operators/ }).click();
  await run(page, 'select date, payee, amount from transactions where amount between -100 and -50;');
  await expect(page.getByText(/Correct —/)).toBeVisible();
  await run(page, 'SELECT date, payee, amount FROM transactions WHERE amount > -100 AND amount < -50;');
  await expect(page.getByText(/Your query returned/)).toBeVisible();
});
test('hints, solution, terminal, seed download and scoped progress reset work', async ({ page }) => {
  await page.goto('/'); await ready(page);
  await page.evaluate(() => localStorage.setItem('another-app', 'keep'));
  await page.getByRole('button', { name: /Show hint 1/ }).click();
  await expect(page.getByText('Start with SELECT: it tells DuckDB you want to read data.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reveal solution', exact: true }).click();
  await expect(page.getByText('0 of 16 lessons completed', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Terminal', exact: true }).click();
  await page.getByRole('textbox', { name: 'Simulated terminal command' }).fill('.tables');
  await page.getByRole('button', { name: 'Enter', exact: true }).click();
  await expect(page.locator('.terminal-screen')).toContainText('accounts  budgets  categories  payees  transactions');
  await page.getByRole('textbox', { name: 'Simulated terminal command' }).fill('SELECT * FROM transactions;');
  await page.getByRole('button', { name: 'Enter', exact: true }).click();
  await expect(page.getByText(/Correct —/)).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'SQL seed', exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('training.sql');
  await page.getByRole('button', { name: 'Reset learning progress', exact: true }).click();
  await page.getByRole('button', { name: 'Reset progress', exact: true }).click();
  await expect(page.getByText('0 of 16 lessons completed', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('another-app'))).toBe('keep');
});
test('responsive navigation and themes are usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/'); await ready(page);
  await page.getByRole('button', { name: 'Open course navigation', exact: true }).click();
  await page.getByRole('navigation', { name: 'Module 1 lessons' }).getByRole('button', { name: /DISTINCT categories/ }).click();
  await expect(page.getByRole('heading', { name: 'DISTINCT categories', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Colour theme' }).selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('tab', { name: 'Visual', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Run visual query on all 10,000 rows' })).toBeVisible();
});

test('Module 2 keeps syntax optional, preserves progress and supports visual and terminal practice', async ({ page }) => {
  await page.goto('/'); await ready(page);
  await page.getByRole('navigation', { name: 'Module 1 lessons' }).getByRole('button', { name: /Investigate unusually large/ }).click();
  await run(page, lessons[7].solution);
  await page.getByRole('button', { name: 'Next lesson', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'COUNT: rows and missing categories', exact: true })).toBeVisible();
  await expect(page.getByText('MODULE 02 / LESSON 01', { exact: true })).toBeVisible();
  await expect(page.locator('#lesson-syntax')).toBeHidden();
  const syntaxButton = page.getByRole('button', { name: 'Reveal the syntax', exact: true });
  await syntaxButton.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#lesson-syntax')).toBeVisible();
  const taskBeforeSyntax = await page.locator('.task-card').evaluate(element => Boolean(element.compareDocumentPosition(element.nextElementSibling!) & Node.DOCUMENT_POSITION_FOLLOWING));
  expect(taskBeforeSyntax).toBe(true);
  await page.getByRole('button', { name: 'Reset query', exact: true }).click();
  await expect(page.locator('#lesson-syntax')).toBeHidden();
  await run(page, 'SELECT COUNT(category) AS transaction_count, COUNT(category) AS categorised_count, 0 AS missing_count FROM transactions;');
  await expect(page.getByText('The row count is right, but the values differ.', { exact: false })).toBeVisible();
  await page.getByRole('tab', { name: 'Terminal', exact: true }).click();
  await page.getByRole('textbox', { name: 'Simulated terminal command' }).fill(lessons[8].solution);
  await page.getByRole('button', { name: 'Enter', exact: true }).click();
  await expect(page.getByText(/Correct —/)).toBeVisible();
  await page.reload(); await ready(page);
  await expect(page.getByRole('heading', { name: lessons[8].title, exact: true })).toBeVisible();
  await expect(page.getByText('2 of 16 lessons completed', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retry lesson', exact: true }).click();
  await expect(page.getByText('1 of 16 lessons completed', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Visual', exact: true }).click();
  await expect(page.getByText('6 after WHERE', { exact: true })).toBeVisible();
  await page.getByRole('slider', { name: 'Minimum individual purchase', exact: true }).fill('50');
  await expect(page.getByText('3 after WHERE', { exact: true })).toBeVisible();
  await page.getByRole('slider', { name: 'Minimum group total', exact: true }).fill('300');
  await expect(page.getByText(/No sample groups pass HAVING/)).toBeVisible();
  await page.getByRole('slider', { name: 'Minimum group total', exact: true }).fill('0');
  await page.getByRole('button', { name: 'Reveal visual SQL', exact: true }).click();
  await page.getByRole('button', { name: 'Run visual query on all 10,000 rows', exact: true }).click();
  await expect(page.getByText('Query complete', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Colour theme' }).selectOption('light');
  await page.screenshot({ path: 'test-results/module2-desktop-light.png', fullPage: true });
  await page.getByRole('combobox', { name: 'Colour theme' }).selectOption('dark');
  await page.screenshot({ path: 'test-results/module2-desktop-dark.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open course navigation', exact: true }).click();
  await page.getByRole('navigation', { name: 'Module 2 lessons' }).getByRole('button', { name: /Build an independent spending report/ }).click();
  await expect(page.getByRole('heading', { name: lessons[15].title, exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/module2-mobile-dark.png', fullPage: true });
  await page.getByRole('combobox', { name: 'Colour theme' }).selectOption('light');
  await page.screenshot({ path: 'test-results/module2-mobile-light.png', fullPage: true });
});
