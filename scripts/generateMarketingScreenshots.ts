import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from 'playwright';

/**
 * A small Node script that launches the Baby Simulator, runs through a
 * minimal happy-path in a mobile viewport (iPhone 12), and captures a few
 * screenshots that can later be used for marketing collateral.
 *
 * 1. Welcome screen
 * 2. First question screen
 * 3. First timeline view (after the very first choice)
 *
 * Usage:
 *   tsx scripts/generateMarketingScreenshots.ts [url]
 *
 * If no URL is passed, the script defaults to https://www.babysim.fun – the
 * production site. No local dev server needed unless you want to test
 * against a specific environment.
 *
 * The resulting PNG files are written to ./marketing_screenshots/ .
 */

const DEFAULT_URL = 'https://www.babysim.fun/';
const GAME_URL = process.argv[2] ?? DEFAULT_URL;

const OUTPUT_DIR = path.resolve(process.cwd(), 'marketing_screenshots');

// Ensure output directory exists and clean old screenshots
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
} else {
  // Clean old screenshots
  for (const file of fs.readdirSync(OUTPUT_DIR)) {
    fs.unlinkSync(path.join(OUTPUT_DIR, file));
  }
}

async function captureQuestionScreenshot(page: any, filename: string) {
  // Find first visible, enabled option button (excluding nav)
  const buttons = await page.locator('button').all();
  let targetBtn: any = null;
  for (const btn of buttons) {
    if (!(await btn.isVisible()) || !(await btn.isEnabled())) continue;
    const inHeader = await btn.evaluate((el: any) => !!el.closest('header'));
    if (inHeader) continue;
    const txt = (await btn.innerText()).toLowerCase();
    if (['info', 'language', 'home'].some(k => txt.includes(k))) continue;
    targetBtn = btn;
    break;
  }
  if (targetBtn) {
    await targetBtn.scrollIntoViewIfNeeded();
    // offset so header is visible
    await page.evaluate(() => window.scrollBy(0, -80));
  }
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${filename}.png`) });
  console.info(`[marketing] Saved question screenshot ${filename}`);
}

async function waitForGameContent(page: any, description: string, timeout = 30000) {
  console.info(`[marketing] Waiting for ${description}...`);
  
  try {
    // Wait for the page to not be in a loading state
    await page.waitForLoadState('networkidle');
    
    // Wait for either question content or timeline content to appear
    await page.waitForFunction(() => {
      // Check for question content (age indicators, options, etc.)
      const hasQuestionContent = document.querySelector('button') && 
        (document.body.innerText.includes('years old') || 
         document.body.innerText.includes('岁') ||
         document.querySelector('[role="button"]'));
      
      // Check for timeline content
      const hasTimelineContent = document.querySelector('.timeline') ||
        document.querySelector('[data-testid="timeline"]') ||
        document.body.innerText.includes('Timeline');
      
      return hasQuestionContent || hasTimelineContent;
    }, { timeout });
    
    // Additional wait for content to fully render
    await page.waitForTimeout(2000);
    
    console.info(`[marketing] ✓ ${description} content detected`);
    return true;
  } catch (error) {
    console.warn(`[marketing] ⚠ Timeout waiting for ${description}: ${error.message}`);
    return false;
  }
}

async function saveScreenshot(page: any, filename: string) {
  const filepath = path.join(OUTPUT_DIR, `${filename}.png`);
  
  // Debug: Check what's on the page
  const title = await page.title();
  const url = page.url();
  console.info(`[marketing] About to capture ${filename}:`);
  console.info(`[marketing]   - URL: ${url}`);
  console.info(`[marketing]   - Title: ${title}`);
  
  // Check for key content indicators
  const bodyText = await page.textContent('body');
  const hasQuestion = bodyText.includes('years old') || bodyText.includes('岁');
  const hasTimeline = bodyText.includes('Timeline') || bodyText.includes('timeline');
  const hasWelcome = bodyText.includes('Baby Simulator') || bodyText.includes('养娃模拟器');
  const hasEnding = bodyText.includes('18') && bodyText.includes('years');
  
  console.info(`[marketing]   - Has question: ${hasQuestion}`);
  console.info(`[marketing]   - Has timeline: ${hasTimeline}`);
  console.info(`[marketing]   - Has welcome: ${hasWelcome}`);
  console.info(`[marketing]   - Has ending: ${hasEnding}`);
  
  await page.screenshot({ path: filepath, fullPage: true });
  console.info(`[marketing] Saved ${filepath}`);
}

async function run() {
  console.info(`[marketing] Launching browser…`);
  const browser = await chromium.launch({ headless: true });

  try {
    // Create a new page with iPhone 12 viewport
    const context = await browser.newContext({
      ...devices['iPhone 12'],
    });
    const page = await context.newPage();

    console.info(`[marketing] Navigating to ${GAME_URL}`);
    await page.goto(GAME_URL, { waitUntil: 'networkidle' });

    // ──────────────────────────────────────────────
    // 1. Welcome screen
    // ──────────────────────────────────────────────
    await page.waitForSelector('button');
    await page.waitForTimeout(2000); // Give animations time
    await saveScreenshot(page, '01_welcome');

    // ──────────────────────────────────────────────
    // 2. Start the game
    // ──────────────────────────────────────────────
    console.info('[marketing] Looking for start game button…');
    
    // Try multiple patterns for the start button
    const startButtonSelectors = [
      'button:has-text("ready")',
      'button:has-text("meet")',
      'button:has-text("baby")',
      'button:has-text("开始")',
      'button:has-text("我")',
    ];
    
    let clicked = false;
    for (const selector of startButtonSelectors) {
      const btn = await page.locator(selector).first();
      if (await btn.count() > 0 && await btn.isVisible()) {
        console.info(`[marketing] Found start button with selector: ${selector}`);
        await btn.evaluate(el => (el as HTMLElement).click()); // force click via JS to bypass overlays
        clicked = true;
        break;
      }
    }

    if (!clicked) {
      // Fallback: click the first visible button via JS
      const firstBtn = await page.locator('button').first();
      if (await firstBtn.count() > 0) {
        console.info('[marketing] Using fallback: clicking first button via JS');
        await firstBtn.evaluate(el => (el as HTMLElement).click());
      } else {
        throw new Error('Unable to find any clickable start button.');
      }
    }

    // Wait until the start button disappears indicating navigation to the game screen
    let movedPastWelcome = false;
    try {
      await page.waitForSelector('button:has-text("ready")', { state: 'detached', timeout: 10000 });
      movedPastWelcome = true;
    } catch {}
    console.info(`[marketing] Moved past welcome: ${movedPastWelcome}`);

    // ──────────────────────────────────────────────
    // 3. Wait for and capture first question
    // ──────────────────────────────────────────────
    const hasFirstQuestion = await waitForGameContent(page, 'first question');
    if (hasFirstQuestion) {
      await captureQuestionScreenshot(page, '02_first_question');
      
      // Make the first choice
      console.info('[marketing] Making first choice...');
      const buttons = await page.locator('button').all();
      let firstOption: any = null;
      for (const btn of buttons) {
        if (!(await btn.isVisible()) || !(await btn.isEnabled())) continue;
        const inHeader = await btn.evaluate((el: any) => !!el.closest('header'));
        if (inHeader) continue;
        const txt = (await btn.innerText()).toLowerCase();
        if (['info', 'language', 'home'].some(k => txt.includes(k))) continue;
        firstOption = btn;
        break;
      }
      if (firstOption) {
        await firstOption.click();
        await page.waitForTimeout(4000);
      }
    }

    // ──────────────────────────────────────────────
    // 4. Continue through many years of the game
    // ──────────────────────────────────────────────
    let year = 2;
    let questionsWithoutProgress = 0;
    const maxQuestionsWithoutProgress = 3;
    const maxYears = 18; // Play until child is 18
    
    while (year <= maxYears && questionsWithoutProgress < maxQuestionsWithoutProgress) {
      console.info(`[marketing] Progressing to year ${year}...`);
      
      const hasNextQuestion = await waitForGameContent(page, `year ${year} question`, 15000);
      if (hasNextQuestion) {
        questionsWithoutProgress = 0; // Reset counter
        
        // Capture the question for this year
        await captureQuestionScreenshot(page, `year_${year.toString().padStart(2, '0')}_question`);
        
        // Make a random choice
        const buttons = await page.locator('button').all();
        const availableOptions: any[] = [];
        for (const btn of buttons) {
          if (!(await btn.isVisible()) || !(await btn.isEnabled())) continue;
          // Exclude buttons inside header/nav (likely navigation or info links)
          const inHeader = await btn.evaluate(el => !!el.closest('header'));
          if (inHeader) continue;
          // Exclude obvious nav buttons by text
          const text = (await btn.innerText()).toLowerCase();
          if (['info', 'language', 'home'].some(k => text.includes(k))) continue;
          availableOptions.push(btn);
        }
        
        if (availableOptions.length > 0) {
          // Make a random choice (not just cycling through)
          const randomIndex = Math.floor(Math.random() * availableOptions.length);
          console.info(`[marketing] Making random choice ${randomIndex + 1} of ${availableOptions.length} for year ${year}`);
          await availableOptions[randomIndex].click();
          await page.waitForTimeout(4000); // Wait for processing
          
          year++;
        } else {
          console.info(`[marketing] No available options found for year ${year}`);
          questionsWithoutProgress++;
        }
      } else {
        console.info(`[marketing] No question content found for year ${year}`);
        questionsWithoutProgress++;
        
        // Try to continue anyway in case the game is still progressing
        year++;
      }
    }
    
    // ──────────────────────────────────────────────
    // 5. Final capture
    // ──────────────────────────────────────────────
    console.info('[marketing] Capturing final screen...');
    await page.waitForTimeout(3000);
    await captureQuestionScreenshot(page, 'final_complete_screen');

    console.info(`[marketing] Screenshots saved to ${OUTPUT_DIR}`);
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error('[marketing] Script failed:', err);
  process.exit(1);
});