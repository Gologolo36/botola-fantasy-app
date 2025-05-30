
import { test, expect } from '@playwright/test';

// IMPORTANT: REPLACE THESE WITH YOUR ACTUAL TEST USER'S CREDENTIALS
const testUserEmail = 'amed74820@gmail.com'; // Use a user that exists in your Firebase Auth
const testUserPassword = 'YOUR_TEST_PASSWORD'; // Use their actual password

test.beforeEach(async ({ page }) => {
  await page.goto('/'); // Navigate to the root URL before each test
});

test('Authentication Flow: should allow a user to log in and see the sign out button', async ({ page }) => {
  // 1. Fill in email and password
  // Using getByPlaceholder to be more specific if Labels are not correctly associated or change
  await page.getByPlaceholder('your@email.com').fill(testUserEmail);
  await page.getByPlaceholder('••••••••').fill(testUserPassword);

  // 2. Click the Login button
  // Add a longer timeout for the click itself, in case the element is busy/detaches
  await page.getByRole('button', { name: 'Log In' }).click({ timeout: 20000 });

  // 3. Wait for the page state to settle after login
  // These waits ensure the DOM is loaded and network activity is idle
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('load');
  await page.waitForLoadState('networkidle');

  // --- MODIFICATIONS START HERE ---

  // 4. Assert that the generic "Welcome," message part is visible first (more flexible)
  // This assumes the welcome message includes the user's email prefix or full email.
  // Example: "Welcome, amed74820!" or "Welcome, amed74820@gmail.com!"
  const welcomeMessageText = page.getByText(/Welcome,.*amed74820/i); // Using a regex for flexibility
  await expect(welcomeMessageText).toBeVisible({ timeout: 20000 }); // Increased timeout for robustness

  // 5. Assert that the specific user's full email is visible anywhere on the page (after "Welcome,")
  // This is a secondary check to ensure the correct user details are displayed if needed,
  // though often the welcome message structure itself is sufficient.
  const specificEmailText = page.getByText(testUserEmail, { exact: true }); // Check for exact email match
  // Depending on how the email is displayed, this might be part of the welcome message or separate.
  // If it's part of the CardTitle, the previous check might cover it.
  // This is a stricter check if needed.
  await expect(specificEmailText).toBeVisible({ timeout: 10000 });


  // 6. Explicitly wait for the Sign Out button's CSS selector to appear in the DOM and then become visible
  // This is often more reliable than just checking visibility if element appears late
  await page.waitForSelector('button:has-text("Sign Out")', { state: 'visible', timeout: 20000 }); // Wait for the button by text and its visible state
  const signOutButtonLocator = page.getByRole('button', { name: 'Sign Out' });
  await expect(signOutButtonLocator).toBeVisible(); // Final check for visibility

  // --- MODIFICATIONS END HERE ---
});
