import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { lessons } from '../../src/content/lessons';
import { statementCSV, cleaningNativeSetup } from '../../src/data/cleaning';
async function ready(page: Page) { await expect(page.getByText('DuckDB ready', { exact: true })).toBeVisible(); }
async function run(page: Page, sql: string) {
  await page.getByRole('tab', { name: 'SQL editor', exact: true }).click();
  const toggle = page.getByRole('button', { name: 'Use plain text editor', exact: true });
  if (await toggle.isVisible()) await toggle.click();
  await page.getByRole('textbox', { name: 'SQL query editor', exact: true }).fill(sql);
  await page.getByRole('button', { name: 'Run Query', exact: true }).click();
}
test('Module 4 imports local files, preserves progress and isolates cleaning from finance', async ({ page }) => {
  const externalRequests: string[] = [];
  page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:5173')) externalRequests.push(request.url()); });
  await page.addInitScript(() => {
    if (!localStorage.getItem('duckdb-academy:progress:v1')) {
      const completed = Object.fromEntries([1, 2, 3].flatMap(module => Array.from({ length: 8 }, (_, i) => [`m${module}-${i + 1}`, '2026-01-01T00:00:00Z'])));
      localStorage.setItem('duckdb-academy:progress:v1', JSON.stringify({ version: 1, current: 'm3-8', completed }));
    }
  });
  await page.goto('/'); await ready(page);
  await page.getByRole('button', { name: 'Next lesson', exact: true }).click();
  await ready(page);
  await expect(page.getByRole('heading', { name: lessons[24].title, exact: true })).toBeVisible();
  await expect(page.getByText('24 of 32 lessons completed', { exact: true })).toBeVisible();
  await expect(page.locator('#lesson-syntax')).toBeHidden();
  await expect(page.locator('#complete-answer')).toBeHidden();
  for (const [label, filename] of [['Download statement.csv', 'statement.csv'], ['Download statement.parquet', 'statement.parquet'], ['Download cleaning-setup.sql', 'cleaning-setup.sql']]) {
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: label, exact: true }).click();
    const file = await downloading;
    expect(file.suggestedFilename()).toBe(filename);
    const path = await file.path();
    const bytes = await readFile(path);
    if (filename.endsWith('.csv')) expect(bytes.toString()).toBe(statementCSV());
    else if (filename.endsWith('.sql')) expect(bytes.toString()).toBe(cleaningNativeSetup());
    else { expect(bytes.subarray(0, 4).toString()).toBe('PAR1'); expect(bytes.subarray(-4).toString()).toBe('PAR1'); }
  }
  await run(page, "SELECT * FROM read_csv('private.csv');");
  await expect(page.getByRole('alert', { name: 'SQL query error', exact: true })).toContainText('supplied statement.csv');
  await run(page, lessons[24].solution);
  await expect(page.getByText(/Correct —/)).toBeVisible();
  await page.getByRole('button', { name: 'Reset database', exact: true }).click(); await ready(page);
  await run(page, lessons[24].solution);
  await expect(page.getByText('12 rows', { exact: true })).toBeVisible();
  await page.reload(); await ready(page);
  await expect(page.getByText('25 of 32 lessons completed', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next lesson', exact: true }).click();
  await run(page, lessons[25].solution);
  await expect(page.getByText(/Correct —/)).toBeVisible();
  await expect(page.getByText('3 rows', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Terminal', exact: true }).click();
  await page.getByRole('textbox', { name: 'Simulated terminal command' }).fill('.tables');
  await page.getByRole('button', { name: 'Enter', exact: true }).click();
  await expect(page.locator('.terminal-screen')).toContainText('clean_candidates  raw_statement');
  await page.getByRole('textbox', { name: 'Simulated terminal command' }).fill(lessons[25].solution);
  await page.getByRole('button', { name: 'Enter', exact: true }).click();
  await expect(page.getByText(/Correct —/)).toBeVisible();
  await page.getByRole('tab', { name: 'Visual', exact: true }).click();
  await page.getByRole('combobox', { name: 'Cleaning stage', exact: true }).selectOption('rejected');
  await expect(page.getByText('5 rows in this stage.', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Cleaning stage', exact: true }).selectOption('distinct');
  await expect(page.getByText('6 rows in this stage.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reveal visual SQL', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Run this cleaning stage in DuckDB', exact: true }).click();
  await expect(page.getByText('6 rows', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Colour theme' }).selectOption('light');
  await page.getByRole('heading', { name: 'Follow the statement from raw rows to usable records', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/module4-desktop-light.png' });
  await page.getByRole('combobox', { name: 'Colour theme' }).selectOption('dark');
  await page.getByRole('heading', { name: 'Follow the statement from raw rows to usable records', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/module4-desktop-dark.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open course navigation', exact: true }).click();
  await page.getByRole('navigation', { name: 'Module 4 lessons' }).getByRole('button', { name: /Build a cleaned spending report/ }).click();
  await expect(page.getByRole('heading', { name: lessons[31].title, exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/module4-mobile-dark.png', fullPage: true });
  await page.getByRole('combobox', { name: 'Colour theme' }).selectOption('light');
  await page.screenshot({ path: 'test-results/module4-mobile-light.png', fullPage: true });
  await page.getByRole('button', { name: 'Reveal solution', exact: true }).click();
  await expect(page.locator('#complete-answer pre code')).toHaveText(lessons[31].solution);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Load solution into editor', exact: true }).click();
  await page.getByRole('button', { name: 'Run Query', exact: true }).click();
  await expect(page.getByText(/Correct —/)).toBeVisible();
  await page.getByRole('button', { name: 'Open course navigation', exact: true }).click();
  await page.getByRole('button', { name: /^Module 1:/ }).click();
  await page.getByRole('navigation', { name: 'Module 1 lessons' }).getByRole('button', { name: /Understanding tables and SELECT/ }).click();
  await ready(page);
  await run(page, "SELECT * FROM read_csv('statement.csv');");
  await expect(page.getByRole('alert', { name: 'SQL query error', exact: true })).toContainText('outside');
  await run(page, lessons[0].solution);
  await expect(page.getByText('10,000 rows', { exact: true })).toBeVisible();
  expect(externalRequests).toEqual([]);
});
