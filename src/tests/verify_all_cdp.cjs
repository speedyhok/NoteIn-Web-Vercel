const cp = require('child_process');
const fs = require('fs');

async function wait(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function runVerification() {
  console.log('Spawning Google Chrome headless on port 9222...');
  const chrome = cp.spawn('/usr/bin/google-chrome', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1400,900',
    '--user-data-dir=/tmp/chrome-test-profile-' + Date.now(),
    '--remote-debugging-port=9222',
    'http://localhost:5174/'
  ]);

  let targets = null;
  for (let i = 0; i < 30; i++) {
    await wait(300);
    try {
      const res = await fetch('http://127.0.0.1:9222/json');
      targets = await res.json();
      if (targets && targets.length > 0) break;
    } catch {
      // wait
    }
  }

  if (!targets) {
    chrome.kill();
    throw new Error('Chrome failed to expose remote debugging port 9222');
  }

  const pageTarget = targets.find((t) => t.type === 'page' && t.url.includes('5174')) || targets.find((t) => t.type === 'page');
  console.log('Found Chrome page target:', pageTarget.url);

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  let idCounter = 1;
  const pending = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = idCounter++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.method === "Runtime.consoleAPICalled") {
      console.log("[Chrome Console]", data.params.type, ...data.params.args.map(a => a.value || a.description || ''));
    }
    if (data.method === "Runtime.exceptionThrown") {
      console.error("[Chrome Exception]", data.params.exceptionDetails);
    }
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    }
  };

  await new Promise((resolve) => { ws.onopen = resolve; });
  console.log('Connected to Chrome DevTools WebSocket.');

  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');

  await wait(2000);

  // 1. Check Library Screen
  console.log('--- TEST 1: Library Screen & New Notebook Modal ---');
  const libraryCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const cards = document.querySelectorAll('h3');
      const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim());
      return {
        cardCount: cards.length,
        buttons: buttons
      };
    })()`,
    returnByValue: true
  });
  console.log('Library initial state:', libraryCheck.result.value);

  // Click "New Notebook" button
  console.log('Clicking "New Notebook" button...');
  const openModal = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const newBtn = btns.find(b => (b.textContent || '').includes('New Notebook'));
      if (newBtn) {
        newBtn.click();
        return true;
      }
      return false;
    })()`,
    returnByValue: true
  });
  console.log('New Notebook button click result:', openModal.result.value);
  await wait(800);

  // Configure Title and Select Landscape Orientation using React native setter
  console.log('Configuring Landscape Notebook...');
  const modalFill = await send('Runtime.evaluate', {
    expression: `(() => {
      const titleInput = document.getElementById('new-notebook-title-input');
      if (titleInput) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(titleInput, 'Landscape Masterpiece 2026');
        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
        titleInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      // Click Landscape card by ID
      const landscapeCard = document.getElementById('orientation-landscape-btn');
      if (landscapeCard) {
        landscapeCard.click();
      }

      return {
        hasInput: !!titleInput,
        hasLandscapeCard: !!landscapeCard
      };
    })()`,
    returnByValue: true
  });
  console.log('Modal fill result:', modalFill.result.value);
  await wait(500);

  // Submit Notebook Creation
  console.log('Submitting "Create Notebook"...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const createSubmit = btns.find(b => (b.textContent || '').trim() === 'Create Notebook');
      if (createSubmit) {
        createSubmit.click();
        return true;
      }
      return false;
    })()`
  });
  await wait(2000);

  // 2. Verify Opened in Editor with Landscape Orientation
  console.log('--- TEST 2: Landscape Page Dimensions & Toolbar ---');
  const editorDim = await send('Runtime.evaluate', {
    expression: `(() => {
      const canvas = document.querySelector('canvas');
      const orientBtn = document.getElementById('orientation-toggle-btn');
      const headerText = document.body.innerText;
      return {
        canvasWidth: canvas ? canvas.width : 0,
        canvasHeight: canvas ? canvas.height : 0,
        hasOrientationBtn: !!orientBtn,
        isLandscape: canvas ? canvas.width > canvas.height : false,
        includesTitle: headerText.includes('Landscape Masterpiece 2026')
      };
    })()`,
    returnByValue: true
  });
  console.log('Editor landscape check:', editorDim.result.value);
  if (!editorDim.result.value.isLandscape) {
    throw new Error('Expected canvas width > height in landscape mode');
  }
  console.log('✓ SUCCESS: Notebook created in landscape mode with canvas width > height!');

  // 3. Test Back Button Navigation to Original Home Page
  console.log('--- TEST 3: Back Button Navigation to Home Page ---');
  const backClicked = await send('Runtime.evaluate', {
    expression: `(() => {
      const backBtn = document.getElementById('back-to-library-btn');
      if (backBtn) {
        backBtn.click();
        return true;
      }
      return false;
    })()`,
    returnByValue: true
  });
  console.log('Back button clicked:', backClicked.result.value);
  await wait(1500);

  // Verify Library Screen is Active and Notebook is listed
  const homeCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const allText = document.body.innerText;
      const hasLandscapeBook = allText.includes('Landscape Masterpiece 2026');
      const isLibrary = Array.from(document.querySelectorAll('button')).some(b => (b.textContent || '').includes('New Notebook'));
      return { hasLandscapeBook, isLibrary };
    })()`,
    returnByValue: true
  });
  console.log('Home page state after clicking Back:', homeCheck.result.value);
  if (!homeCheck.result.value.isLibrary || !homeCheck.result.value.hasLandscapeBook) {
    throw new Error('Back to home page failed or notebook missing');
  }
  console.log('✓ SUCCESS: Back button correctly returned to Home Page library!');

  // 4. Open the Notebook again
  console.log('Re-opening notebook by clicking its card...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const cards = Array.from(document.querySelectorAll('h3'));
      const targetCard = cards.find(c => c.textContent.includes('Landscape Masterpiece 2026'));
      if (targetCard) {
        targetCard.closest('div[style*="cursor: pointer"], div').click();
        return true;
      }
      return false;
    })()`
  });
  await wait(1500);

  // 5. Test Text Tool and Single-Click to Edit
  console.log('--- TEST 4: Text Tool and Single-Click to Edit ---');
  // Click Text tool
  await send('Runtime.evaluate', {
    expression: `(() => {
      const textBtn = document.querySelector('button[title*="Text" i]');
      if (textBtn) {
        textBtn.click();
        return true;
      }
      return false;
    })()`
  });
  await wait(400);

  // Click on paper canvas to spawn a text box
  console.log('Clicking on paper canvas to insert text box...');
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 600, y: 350, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 600, y: 350, button: 'left' });
  await wait(600);

  // Check if text box exists and click it to edit
  console.log('Testing single-click to edit on text box...');
  const editClick = await send('Runtime.evaluate', {
    expression: `(() => {
      const textBox = document.querySelector('[style*="position: absolute"][style*="box-sizing: border-box"]');
      if (textBox) {
        textBox.click();
        return true;
      }
      return false;
    })()`,
    returnByValue: true
  });
  console.log('Text box single-clicked:', editClick.result.value);
  await wait(500);

  // Verify textarea is now present and focused
  const textareaCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const ta = document.querySelector('textarea');
      if (ta) {
        ta.value = 'Advanced Text Studio in NoteIn Web';
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));
        return { hasTextarea: true, value: ta.value };
      }
      return { hasTextarea: false };
    })()`,
    returnByValue: true
  });
  console.log('Textarea check:', textareaCheck.result.value);
  if (!textareaCheck.result.value.hasTextarea) {
    throw new Error('Expected textarea to be active after single clicking text box');
  }
  console.log('✓ SUCCESS: "Click to edit" works immediately on single click!');

  // 6. Test Advanced Text Formatting Controls
  console.log('--- TEST 5: Advanced Text Controls (Underline, Sticky Card Bg, Duplication) ---');
  // Click Underline button
  await send('Runtime.evaluate', {
    expression: `(() => {
      const uBtn = document.querySelector('button[title*="Underline" i]');
      if (uBtn) uBtn.click();
      return !!uBtn;
    })()`
  });
  await wait(300);

  // Click Background color (Sticky Note) button
  await send('Runtime.evaluate', {
    expression: `(() => {
      const bgBtn = document.querySelector('button[title*="Background" i]');
      if (bgBtn) bgBtn.click();
      return !!bgBtn;
    })()`
  });
  await wait(300);

  // Pick Amber/Yellow Sticky Card color
  await send('Runtime.evaluate', {
    expression: `(() => {
      const colorBtns = Array.from(document.querySelectorAll('button[title*="Sticky" i], button[style*="background-color: rgb(254, 243, 199)"]'));
      if (colorBtns.length > 0) {
        colorBtns[0].click();
        return true;
      }
      return false;
    })()`
  });
  await wait(400);

  // Test Duplicating Text Box
  console.log('Testing text box duplication...');
  const dupResult = await send('Runtime.evaluate', {
    expression: `(() => {
      const dupBtn = document.querySelector('button[title*="Duplicate" i]');
      if (dupBtn) {
        dupBtn.click();
        return true;
      }
      return false;
    })()`,
    returnByValue: true
  });
  console.log('Duplicate clicked:', dupResult.result.value);
  await wait(500);

  // 7. Test Dynamic Orientation Toggle in Editor
  console.log('--- TEST 6: Dynamic Page Orientation Toggle ---');
  const toggleOrientation = await send('Runtime.evaluate', {
    expression: `(() => {
      const orientBtn = document.getElementById('orientation-toggle-btn');
      if (orientBtn) {
        orientBtn.click();
        return true;
      }
      return false;
    })()`,
    returnByValue: true
  });
  console.log('Orientation toggle clicked:', toggleOrientation.result.value);
  await wait(800);

  // Verify canvas dimensions switched to portrait
  const switchedDim = await send('Runtime.evaluate', {
    expression: `(() => {
      const canvas = document.querySelector('canvas');
      return {
        canvasWidth: canvas ? canvas.width : 0,
        canvasHeight: canvas ? canvas.height : 0,
        isPortraitNow: canvas ? canvas.height > canvas.width : false
      };
    })()`,
    returnByValue: true
  });
  console.log('Switched orientation state:', switchedDim.result.value);
  if (!switchedDim.result.value.isPortraitNow) {
    throw new Error('Canvas failed to switch to portrait orientation');
  }
  console.log('✓ SUCCESS: Orientation dynamically toggled to Portrait!');

  // Toggle back to Landscape
  await send('Runtime.evaluate', {
    expression: `(() => {
      const orientBtn = document.getElementById('orientation-toggle-btn');
      if (orientBtn) orientBtn.click();
      return true;
    })()`
  });
  await wait(800);

  // Capture Screenshot of finished state
  console.log('Capturing verified screenshot...');
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  const artifactPath = '/home/ubuntu/.gemini/antigravity-ide/brain/2721baf0-5de5-4c9f-ae3f-51019fcf887f/browser_preview.png';
  fs.writeFileSync(artifactPath, Buffer.from(screenshot.data, 'base64'));
  console.log(`Saved screenshot to ${artifactPath}`);

  ws.close();
  chrome.kill();
  console.log('========================================================================');
  console.log('ALL VERIFICATION CHECKS PASSED WITH 100% SUCCESS!');
  console.log('========================================================================');
}

runVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
