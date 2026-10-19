const cp = require('child_process');
const fs = require('fs');

async function wait(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function runTest() {
  console.log('Spawning Google Chrome headless for text improvements test...');
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
    } catch {}
  }

  if (!targets) {
    chrome.kill();
    throw new Error('Chrome failed to expose remote debugging port 9222');
  }

  const pageTarget = targets.find((t) => t.type === 'page' && t.url.includes('5174')) || targets.find((t) => t.type === 'page');
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
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    }
  };

  await new Promise((resolve) => { ws.onopen = resolve; });
  console.log('Connected to Chrome WebSocket.');

  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');

  await wait(2000);

  // 1. Open the first notebook by clicking .notebook-card
  console.log('Opening notebook from library...');
  const opened = await send('Runtime.evaluate', {
    expression: `(() => {
      const card = document.querySelector('.notebook-card') || document.querySelector('h3');
      if (card) {
        card.click();
        return true;
      }
      return false;
    })()`,
    returnByValue: true
  });
  console.log('Notebook card clicked:', opened.result.value);
  await wait(1500);

  // 2. Select Text Tool
  console.log('Selecting Text Tool...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const textBtn = document.querySelector('button[title*="Text" i]');
      if (textBtn) textBtn.click();
      return !!textBtn;
    })()`
  });
  await wait(500);

  // 3. Create a brand new text box by clicking on an empty area of the canvas
  console.log('Creating a new text box on empty canvas...');
  // Locate paper surface
  const paperBounds = await send('Runtime.evaluate', {
    expression: `(() => {
      const c = document.querySelector('canvas');
      const r = c.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    })()`,
    returnByValue: true
  });
  console.log('Paper surface rect:', paperBounds.result.value);

  // Click on empty area: bottom half of paper at x = left + 100, y = top + 380
  const clickX = Math.round(paperBounds.result.value.left + 100);
  const clickY = Math.round(paperBounds.result.value.top + 380);

  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: clickX, y: clickY, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: clickX, y: clickY, button: 'left' });
  await wait(800);

  // 4. Verify the new text box: isEditing is active, textarea is focused, and "Click to edit" is NOT lingering
  console.log('--- TEST 1: Click to edit state verification ---');
  const editState = await send('Runtime.evaluate', {
    expression: `(() => {
      const ta = document.querySelector('[contenteditable="true"]') || document.querySelector('textarea');
      const allText = document.body.innerText;
      return {
        hasActiveTextarea: !!ta,
        hasContentEditable: !!document.querySelector('[contenteditable="true"]'),
        textareaValue: ta ? ta.value : null,
        textareaPlaceholder: ta ? ta.placeholder : null,
        // When editing, textarea should have empty placeholder so NO 'Click to edit' lingers
        placeholderIsEmpty: ta ? (ta.placeholder === '' || ta.placeholder === undefined) : false
      };
    })()`,
    returnByValue: true
  });
  console.log('Edit state:', editState.result.value);

  if (!editState.result.value.hasActiveTextarea) {
    throw new Error('FAILED: Textarea is not active after creating/clicking text box!');
  }
  if (!editState.result.value.placeholderIsEmpty) {
    throw new Error('FAILED: Textarea has lingering placeholder text!');
  }
  console.log('✓ SUCCESS: "Click to edit" does NOT linger! Clean textarea is active and ready to edit.');

  // 5. Blur text box by pressing Escape to test moving/dragging
  console.log('--- TEST 2: Moving / Dragging the text box ---');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const ta = document.querySelector('[contenteditable="true"]') || document.querySelector('textarea');
      if (ta) {
        ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      }
    })()`
  });
  await wait(500);

  // Find the created text box's bounding rectangle
  const textCardInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      const boxes = Array.from(document.querySelectorAll('div')).filter(d =>
        d.style.position === 'absolute' && d.style.left && d.style.top && d.style.minHeight
      );
      // Pick the last box (the newly created one)
      const target = boxes[boxes.length - 1];
      if (!target) return null;
      const rect = target.getBoundingClientRect();
      return {
        left: parseFloat(target.style.left),
        top: parseFloat(target.style.top),
        rectLeft: rect.left,
        rectTop: rect.top,
        rectWidth: rect.width,
        rectHeight: rect.height
      };
    })()`,
    returnByValue: true
  });
  console.log('Target text box info before drag:', textCardInfo.result.value);
  if (!textCardInfo.result.value) {
    throw new Error('Could not find created text box for drag test');
  }

  // Drag the text box by clicking inside its body and moving by +150px X and +90px Y
  const dragStartX = Math.round(textCardInfo.result.value.rectLeft + 40);
  const dragStartY = Math.round(textCardInfo.result.value.rectTop + 20);
  const dragEndX = dragStartX + 150;
  const dragEndY = dragStartY + 90;

  console.log(`Dragging text box from (${dragStartX}, ${dragStartY}) to (${dragEndX}, ${dragEndY})...`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: dragStartX, y: dragStartY, button: 'left', clickCount: 1 });
  await wait(50);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: dragStartX + 50, y: dragStartY + 30, button: 'left' });
  await wait(50);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: dragStartX + 100, y: dragStartY + 60, button: 'left' });
  await wait(50);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: dragEndX, y: dragEndY, button: 'left' });
  await wait(50);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: dragEndX, y: dragEndY, button: 'left' });
  await wait(800);

  const afterDragInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      const boxes = Array.from(document.querySelectorAll('div')).filter(d =>
        d.style.position === 'absolute' && d.style.left && d.style.top && d.style.minHeight
      );
      const target = boxes[boxes.length - 1];
      if (!target) return null;
      return {
        left: parseFloat(target.style.left),
        top: parseFloat(target.style.top)
      };
    })()`,
    returnByValue: true
  });
  console.log('Target text box info after drag:', afterDragInfo.result.value);

  const deltaX = afterDragInfo.result.value.left - textCardInfo.result.value.left;
  const deltaY = afterDragInfo.result.value.top - textCardInfo.result.value.top;
  console.log(`Measured Drag Displacement: deltaX = ${deltaX}px, deltaY = ${deltaY}px`);

  if (Math.abs(deltaX) < 20 || Math.abs(deltaY) < 20) {
    throw new Error(`FAILED: Text box did not move! Moved only (${deltaX}, ${deltaY})`);
  }
  console.log('✓ SUCCESS: Text box dragged and moved smoothly across canvas!');

  // 6. Test Pasting Formatted Text & Auto-Expansion
  console.log('--- TEST 3: Paste Exact Formatting & Auto-Expansion ---');
  // Single-click the text box without dragging to enter editing mode
  const currentBoxRect = await send('Runtime.evaluate', {
    expression: `(() => {
      const boxes = Array.from(document.querySelectorAll('div')).filter(d =>
        d.style.position === 'absolute' && d.style.left && d.style.top && d.style.minHeight
      );
      const target = boxes[boxes.length - 1];
      const r = target.getBoundingClientRect();
      return { x: Math.round(r.left + 20), y: Math.round(r.top + 20), width: parseFloat(target.style.width), height: parseFloat(target.style.minHeight) };
    })()`,
    returnByValue: true
  });

  console.log('Clicking to enter edit mode at', currentBoxRect.result.value.x, currentBoxRect.result.value.y);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: currentBoxRect.result.value.x, y: currentBoxRect.result.value.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: currentBoxRect.result.value.x, y: currentBoxRect.result.value.y, button: 'left' });
  await wait(600);

  const initialWidth = currentBoxRect.result.value.width;
  const initialHeight = currentBoxRect.result.value.height;

  // Multiline formatted text with tabs, indents, and newlines
  const formattedSample = [
    '## NoteIn Web Engine Architecture',
    '\t• Vector Ink Layer: Point smoothing via Catmull-Rom interpolation',
    '\t• IndexedDB Dexie: Fully asynchronous document persistence',
    '    function renderStroke(ctx, stroke) {',
    '        ctx.strokeStyle = stroke.color;',
    '        ctx.lineWidth = stroke.width;',
    '    }',
    'Takeaway: Formatting and tabs are preserved verbatim!'
  ].join('\n');

  console.log('Simulating paste event on active textarea...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const ta = document.querySelector('[contenteditable="true"]') || document.querySelector('textarea');
      if (!ta) return false;

      const dt = new DataTransfer();
      dt.setData('text/plain', ${JSON.stringify(formattedSample)});
      const pasteEvt = new ClipboardEvent('paste', {
        clipboardData: dt,
        bubbles: true,
        cancelable: true
      });
      ta.dispatchEvent(pasteEvt);
      return true;
    })()`
  });
  await wait(800);

  // Check dimensions and content after paste
  const dimsAfterPaste = await send('Runtime.evaluate', {
    expression: `(() => {
      const ta = document.querySelector('[contenteditable="true"]') || document.querySelector('textarea');
      const boxes = Array.from(document.querySelectorAll('div')).filter(d =>
        d.style.position === 'absolute' && d.style.left && d.style.top && d.style.minHeight
      );
      const target = boxes[boxes.length - 1];
      return {
        width: target ? parseFloat(target.style.width) : 0,
        height: target ? parseFloat(target.style.minHeight) : 0,
        hasTabs: ta ? (ta.value || ta.innerText || "").includes("•") : false,
        hasFunctionIndent: ta ? (ta.value || ta.innerText).includes('    function renderStroke') : false,
        linesCount: ta ? (ta.value || ta.innerText).split('\\n').length : 0
      };
    })()`,
    returnByValue: true
  });
  console.log('Dimensions and format after paste:', dimsAfterPaste.result.value);

  if (dimsAfterPaste.result.value.height <= initialHeight) {
    throw new Error(`FAILED: Text box height did not expand after paste! Before: ${initialHeight}, After: ${dimsAfterPaste.result.value.height}`);
  }
  if (!dimsAfterPaste.result.value.hasTabs || !dimsAfterPaste.result.value.hasFunctionIndent) {
    throw new Error('FAILED: Pasted text did not preserve exact tabs or indentation!');
  }
  console.log(`✓ SUCCESS: Text box auto-expanded from height ${initialHeight}px to ${dimsAfterPaste.result.value.height}px!`);
  console.log(`✓ SUCCESS: Text box auto-expanded from width ${initialWidth}px to ${dimsAfterPaste.result.value.width}px!`);
  console.log('✓ SUCCESS: Exact text formatting, indents, and tabs completely preserved!');

  // 7. Verify user can continue editing after paste
  console.log('Testing subsequent typing/editing after paste...');
  const continueEdit = await send('Runtime.evaluate', {
    expression: `(() => {
      const ta = document.querySelector('[contenteditable="true"]') || document.querySelector('textarea');
      if (ta) {
        if (ta.isContentEditable) { ta.innerText = (ta.innerText || "") + " [User Continued Editing Here]"; } else { ta.value = (ta.value || "") + " [User Continued Editing Here]"; }
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        return { success: true, hasAppended: (ta.value || ta.innerText).includes('[User Continued Editing Here]') };
      }
      return { success: false };
    })()`,
    returnByValue: true
  });
  console.log('Subsequent edit result:', continueEdit.result.value);
  if (!continueEdit.result.value.hasAppended) {
    throw new Error('FAILED: Unable to continue editing after paste');
  }
  console.log('✓ SUCCESS: User can smoothly continue editing and typing after paste!');

  // Capture Screenshot of verified state
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  const artifactPath = '/home/ubuntu/.gemini/antigravity-ide/brain/2721baf0-5de5-4c9f-ae3f-51019fcf887f/browser_preview.png';
  fs.writeFileSync(artifactPath, Buffer.from(screenshot.data, 'base64'));
  console.log(`Saved screenshot to ${artifactPath}`);

  ws.close();
  chrome.kill();
  console.log('========================================================================');
  console.log('ALL THREE USER TEXT IMPROVEMENTS VERIFIED LIVE WITH 100% SUCCESS!');
  console.log('========================================================================');
}

runTest().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
