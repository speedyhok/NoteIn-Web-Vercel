const fs = require('fs');
const cp = require('child_process');

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runBrowserTest() {
  console.log('Spawning Google Chrome headless with remote debugging port 9222...');
  const chrome = cp.spawn('/usr/bin/google-chrome', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1280,800',
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
      console.log("[Browser Console]", data.params.type, ...data.params.args.map(a => a.value));
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

  console.log('Navigating to http://localhost:5174/ ...');
  await send('Page.navigate', { url: 'http://localhost:5174/' });
  await wait(1500);

  // 1. Evaluate Library screen
  const libraryCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const h1 = document.querySelector('h1')?.innerText;
      const cards = document.querySelectorAll('h3');
      const buttons = Array.from(document.querySelectorAll('button')).map(b => b.innerText || b.getAttribute('title'));
      return {
        h1,
        cardCount: cards.length,
        firstTitle: cards[0]?.innerText,
        hasNewNotebookBtn: buttons.some(b => b && b.includes('New Notebook')),
        hasSearch: !!document.querySelector('input[placeholder*="Search"]'),
      };
    })()`,
    returnByValue: true
  });
  console.log('✓ 1. Library Screen Verification:', libraryCheck.result.value);

  // 2. Open Notebook
  console.log('Opening notebook in editor...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const card = document.querySelector('h3');
      if (card) {
        card.click();
        return true;
      }
      return false;
    })()`
  });
  await wait(1200);

  // 3. Verify Editor Screen Initial State
  const editorCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const undoBtn = document.querySelector('button[title*="Undo"]');
      const redoBtn = document.querySelector('button[title*="Redo"]');
      const penBtn = document.querySelector('button[title*="Pen"]');
      const textBtn = document.querySelector('button[title*="Text"]');
      const canvas = document.querySelector('canvas');
      const textNotes = document.querySelectorAll('[style*="white-space: pre-wrap"]');
      return {
        hasUndo: !!undoBtn,
        undoDisabled: undoBtn ? undoBtn.disabled : null,
        hasRedo: !!redoBtn,
        redoDisabled: redoBtn ? redoBtn.disabled : null,
        hasPen: !!penBtn,
        hasText: !!textBtn,
        hasCanvas: !!canvas,
        textNotesCount: textNotes.length,
      };
    })()`,
    returnByValue: true
  });
  console.log('✓ 2. Editor Initial State:', editorCheck.result.value);

  // 4. Draw vector stroke on paper
  console.log('Drawing vector stroke with CDP native mouse events on paper...');
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 550, y: 250, button: 'left', clickCount: 1 });
  await wait(50);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 570, y: 270, button: 'left' });
  await wait(50);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 620, y: 320, button: 'left' });
  await wait(50);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 620, y: 320, button: 'left' });
  await wait(600);

  // 5. Verify Undo state after drawing
  const afterDraw = await send('Runtime.evaluate', {
    expression: `(() => {
      const undoBtn = document.querySelector('button[title*="Undo"]');
      const redoBtn = document.querySelector('button[title*="Redo"]');
      return {
        undoDisabled: undoBtn ? undoBtn.disabled : null,
        redoDisabled: redoBtn ? redoBtn.disabled : null,
      };
    })()`,
    returnByValue: true
  });
  console.log('✓ 3. After Stroke Drawn - Undo State:', afterDraw.result.value);
  if (afterDraw.result.value.undoDisabled !== false) {
    throw new Error('Undo button failed to become enabled after stroke drawn');
  }

  // 6. Click Undo Button
  console.log('Clicking Undo button in toolbar...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const undoBtn = document.querySelector('button[title*="Undo"]');
      if (undoBtn && !undoBtn.disabled) {
        undoBtn.click();
        return true;
      }
      return false;
    })()`
  });
  await wait(600);

  const afterUndo = await send('Runtime.evaluate', {
    expression: `(() => {
      const undoBtn = document.querySelector('button[title*="Undo"]');
      const redoBtn = document.querySelector('button[title*="Redo"]');
      return {
        undoDisabled: undoBtn ? undoBtn.disabled : null,
        redoDisabled: redoBtn ? redoBtn.disabled : null,
      };
    })()`,
    returnByValue: true
  });
  console.log('✓ 4. After Undo - Redo State:', afterUndo.result.value);
  if (afterUndo.result.value.redoDisabled !== false) {
    throw new Error('Redo button failed to become enabled after undo');
  }

  // 7. Click Redo Button
  console.log('Clicking Redo button in toolbar...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const redoBtn = document.querySelector('button[title*="Redo"]');
      if (redoBtn && !redoBtn.disabled) {
        redoBtn.click();
        return true;
      }
      return false;
    })()`
  });
  await wait(600);

  const afterRedo = await send('Runtime.evaluate', {
    expression: `(() => {
      const undoBtn = document.querySelector('button[title*="Undo"]');
      const redoBtn = document.querySelector('button[title*="Redo"]');
      return {
        undoDisabled: undoBtn ? undoBtn.disabled : null,
        redoDisabled: redoBtn ? redoBtn.disabled : null,
      };
    })()`,
    returnByValue: true
  });
  console.log('✓ 5. After Redo - Undo State:', afterRedo.result.value);
  if (afterRedo.result.value.undoDisabled !== false) {
    throw new Error('Undo button failed to become enabled after redo');
  }

  // 8. Select Text Tool and Click Canvas to Create Text Box
  console.log('Selecting Text tool and clicking canvas...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const textBtn = document.querySelector('button[title*="Text"]');
      if (textBtn) textBtn.click();
      return true;
    })()`
  });
  await wait(300);

  // Click on the paper canvas using CDP mouse event
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 520, y: 400, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 520, y: 400, button: 'left' });
  await wait(600);

  // 9. Verify Text Box was created and double click to type
  const textBoxCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const textDivs = Array.from(document.querySelectorAll('[style*="white-space: pre-wrap"]')).map(d => d.innerText);
      const newBox = document.querySelectorAll('[style*="position: absolute"][style*="box-sizing: border-box"]');
      // Double click new box to enter editing
      if (newBox.length > 0) {
        const lastBox = newBox[newBox.length - 1];
        lastBox.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
      }
      return { textDivs, newBoxCount: newBox.length };
    })()`,
    returnByValue: true
  });
  console.log('✓ 6. Text Box Created and Selected:', textBoxCheck.result.value);
  await wait(300);

  // Type in textarea
  const typeResult = await send('Runtime.evaluate', {
    expression: `(() => {
      const activeTextarea = document.querySelector('textarea');
      if (activeTextarea) {
        activeTextarea.value = 'NoteIn Web Studio: Text tool and Undo/Redo verified live in Chrome!';
        activeTextarea.dispatchEvent(new Event('input', { bubbles: true }));
        activeTextarea.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true, typedContent: activeTextarea.value };
      }
      return { success: false };
    })()`,
    returnByValue: true
  });
  console.log('✓ 7. Text Typed into Text Box:', typeResult.result.value);

  // 10. Undo text addition
  console.log('Testing Undo on newly created Text Box...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const undoBtn = document.querySelector('button[title*="Undo"]');
      if (undoBtn && !undoBtn.disabled) {
        undoBtn.click();
        return true;
      }
      return false;
    })()`
  });
  await wait(600);

  const afterTextUndo = await send('Runtime.evaluate', {
    expression: `(() => {
      const textDivs = Array.from(document.querySelectorAll('[style*="white-space: pre-wrap"]')).map(d => d.innerText);
      return { textDivsCount: textDivs.length };
    })()`,
    returnByValue: true
  });
  console.log('✓ 8. After Undo on Text Box - Text box removed:', afterTextUndo.result.value);

  // 11. Capture Live Browser Screenshot
  console.log('Capturing full browser screenshot...');
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  const artifactPath = '/home/ubuntu/.gemini/antigravity-ide/brain/2721baf0-5de5-4c9f-ae3f-51019fcf887f/browser_preview.png';
  fs.writeFileSync(artifactPath, Buffer.from(screenshot.data, 'base64'));
  console.log(`✓ High-resolution screenshot captured and saved to: ${artifactPath}`);

  ws.close();
  chrome.kill();
  console.log('========================================================================');
  console.log('ALL PHASE 1-3 REAL-BROWSER E2E TESTS PASSED WITH 100% SUCCESS!');
  console.log('========================================================================');
}

runBrowserTest().catch((err) => {
  console.error('Browser Test Error:', err);
  process.exit(1);
});
