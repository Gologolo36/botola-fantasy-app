
import { test, expect } from '@playwright/test';

// Use test.describe to group related tests
test.describe('Authentication Flow', () => {
  test('should allow a user to log in and see the sign out button', async ({ page }) => {
    // 1. Navigate to the app's root URL
    await page.goto('/');

    // Wait for the main content to be generally available
    // This can help with elements not being ready immediately after navigation.
    await page.waitForSelector('h1:has-text("Botola Pro Fantasy")');
    
    // IMPORTANT: Replace with your actual test user's email and password
    // These credentials should match the user you created in Firebase Authentication
    const testUserEmail = 'amed74820@gmail.com'; // Replace with your test user's email
    const testUserPassword = 'YOUR_ACTUAL_PASSWORD_HERE'; // Replace with your actual password here

    // 2. Fill in the email and password
    // Ensure labels are correctly associated with inputs in your page.tsx
    // For example, <Label htmlFor="email">Email</Label> <Input id="email" ... />
    await page.getByLabel('Email').fill(testUserEmail);
    await page.getByLabel('Password').fill(testUserPassword);

    // 3. Click the 'Log In' button
    await page.getByRole('button', { name: 'Log In' }).click();

    // 4. Waits for the 'Welcome, [user email prefix]!' message to appear on the page.
    // Assert that the welcome message containing the full email is visible
    const welcomeMessageLocator = page.getByText(`Welcome, ${testUserEmail}!`);
    await expect(welcomeMessageLocator).toBeVisible({ timeout: 10000 }); // Increased timeout for login processing


    // 5. Asserts (verifies) that the 'Sign Out' button is visible.
    const signOutButtonLocator = page.getByRole('button', { name: 'Sign Out' });
    await expect(signOutButtonLocator).toBeVisible();

    // Optional: Add a step to sign out to clean up state for subsequent tests if needed
    // await signOutButtonLocator.click();
    // await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible();
  });
});
