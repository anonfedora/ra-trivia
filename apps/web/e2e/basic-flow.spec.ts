import { test, expect } from '@playwright/test';

test.describe('Basic Auth and Quiz Flow', () => {
  test('should allow a user to navigate to the landing page', async ({ page }) => {
    await page.goto('/');
    
    // Check if the landing page content is visible
    await expect(page).toHaveTitle(/RA Trivia/i);
    await expect(page.getByText(/Are you ready to test your knowledge/i)).toBeVisible();
  });

  test('should show login modal when clicking join exam', async ({ page }) => {
    await page.goto('/');
    
    // Click join exam
    await page.getByRole('button', { name: /Join Exam/i }).first().click();
    
    // Check if login modal appears
    await expect(page.getByRole('heading', { name: /Login/i })).toBeVisible();
    await expect(page.getByLabel(/Email Address/i)).toBeVisible();
  });
});
