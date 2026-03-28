const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });
  
  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
  });

  await page.goto('http://localhost:3000/game');
  
  // Wait for client-side hydration
  await page.waitForTimeout(2000);
  
  // Check page content
  const html = await page.content();
  
  // Look for key elements
  const hasBoard = html.includes('cm-chessboard');
  const hasClashMate = html.includes('ClashMate');
  const status = html.includes('Playing') ? 'Playing' : (html.includes('Waiting') ? 'Waiting' : 'Unknown');
  
  console.log('=== RESULTS ===');
  console.log('Has board container:', hasBoard);
  console.log('Has ClashMate title:', hasClashMate);
  console.log('Game status:', status);
  
  // Check console messages
  console.log('\n=== CONSOLE MESSAGES ===');
  consoleMessages.forEach(m => {
    console.log(`[${m.type}] ${m.text}`);
  });
  
  // Try to find the board element and check its structure
  const boardInfo = await page.evaluate(() => {
    const container = document.querySelector('.w-full.max-w-\\[500px\\]');
    if (!container) return { found: false };
    
    const svg = container.querySelector('svg');
    return {
      found: true,
      hasSvg: !!svg,
      innerHTML: container.innerHTML.substring(0, 500)
    };
  });
  
  console.log('\n=== BOARD INFO ===');
  console.log(JSON.stringify(boardInfo, null, 2));
  
  await browser.close();
})();
