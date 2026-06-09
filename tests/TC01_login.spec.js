require('dotenv').config();

const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../pages/loginPage');
const { Logger } = require('../utils/logger');
const { InteractionLogger } = require('../utils/InteractionLogger');
const authKitMessages = require('../fixture/authKitMessages.json');

const LOGIN_SCREENSHOT_OPTIONS = {
  fullPage: true,
  animations: 'disabled',
  // Headed + hosted auth UI can shift slightly between runs.
  maxDiffPixels: 15000,
  maxDiffPixelRatio: 0.15,
};

test.describe('Tailorbird Login Flow', () => {
  let context;
  let page;
  let login;

  test('TC01 @sanity @mandatory @login User should be able to submit credentials successfully', async ({ browser }) => {
    Logger.info('Starting Tailorbird login test...');

    context = await browser.newContext();
    page = await context.newPage();
    login = new LoginPage(page);

    await test.step('Go to login page', async () => {
      Logger.step('Navigating to login URL...');
      await page.goto(process.env.LOGIN_URL, { waitUntil: 'load' });
    });

    await test.step('Perform login', async () => {
      Logger.step('Using credentials from .env...');
      await login.login(process.env.TEST_EMAIL, process.env.TEST_PASSWORD);
    });

    await test.step('Store Session', async () => {
      await page.context().storageState({ path: 'sessionState.json' });
      Logger.success('💾 Session stored successfully at sessionState.json');
    });

    await test.step('Close Context', async () => {
      await context.close();
    });
  });


});
