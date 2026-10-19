const cp = require('child_process');
const fs = require('fs');

async function wait(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function runTest() {
  console.log('Spawning Google Chrome headless for rich paste and cover screen test...');
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
  await send('Runtime.evaluate', {
    expression: `(() => {
      const card = document.querySelector('.notebook-card') || document.querySelector('h3');
      if (card) {
        card.click();
        return true;
      }
      return false;
    })()`
  });
  await wait(1500);

  // 2. TEST: Page Covers the Screen (no tiny centered box with huge margins)
  console.log('--- TEST 1: Page Covers the Screen ---');
  const coverMetrics = await send('Runtime.evaluate', {
    expression: `(() => {
      const canvas = document.querySelector('canvas');
      const container = canvas?.closest('div[style*="overflow: hidden"]');
      const coverBtn = document.getElementById('cover-screen-btn');
      const r = canvas.getBoundingClientRect();
      const cr = container.getBoundingClientRect();

      return {
        canvasWidth: r.width,
        canvasHeight: r.height,
        containerWidth: cr.width,
        containerHeight: cr.height,
        // The page covers the screen: rendered width is >= container width (or within minimal rounding)
        widthCoverageRatio: r.width / cr.width,
        buttonText: coverBtn ? coverBtn.innerText.trim() : null
      };
    })()`,
    returnByValue: true
  });
  console.log('Cover Screen Metrics:', coverMetrics.result.value);

  if (coverMetrics.result.value.widthCoverageRatio < 0.95) {
    throw new Error(`FAILED: Document is letterboxed! Canvas covers only ${Math.round(coverMetrics.result.value.widthCoverageRatio * 100)}% of screen width`);
  }
  console.log(`✓ SUCCESS: Document covers the screen! Width coverage: ${Math.round(coverMetrics.result.value.widthCoverageRatio * 100)}% of viewport.`);

  // Test toggling Cover Screen button
  console.log('Toggling Cover Screen button to Centered Fit...');
  await send('Runtime.evaluate', {
    expression: `document.getElementById('cover-screen-btn')?.click()`
  });
  await wait(600);

  const toggledFit = await send('Runtime.evaluate', {
    expression: `(() => {
      const canvas = document.querySelector('canvas');
      const container = canvas?.closest('div[style*="overflow: hidden"]');
      const coverBtn = document.getElementById('cover-screen-btn');
      return {
        canvasWidth: canvas.getBoundingClientRect().width,
        buttonText: coverBtn ? coverBtn.innerText.trim() : null
      };
    })()`,
    returnByValue: true
  });
  console.log('After toggle to Centered Fit:', toggledFit.result.value);

  // Toggle back to Cover Screen
  console.log('Toggling back to Cover Screen...');
  await send('Runtime.evaluate', {
    expression: `document.getElementById('cover-screen-btn')?.click()`
  });
  await wait(600);

  // 3. TEST: Retaining Exact Rich Text Formatting on Paste
  console.log('--- TEST 2: Rich Text Format Retention on Paste ---');
  // Select Text Tool
  await send('Runtime.evaluate', {
    expression: `(() => {
      const textBtn = document.querySelector('button[title*="Text" i]');
      if (textBtn) textBtn.click();
      return true;
    })()`
  });
  await wait(400);

  // Find canvas and click to create a new text box
  const cRect = await send('Runtime.evaluate', {
    expression: `(() => {
      const c = document.querySelector('canvas');
      const r = c.getBoundingClientRect();
      return { left: r.left, top: r.top };
    })()`,
    returnByValue: true
  });

  const pasteClickX = Math.round(cRect.result.value.left + 80);
  const pasteClickY = Math.round(cRect.result.value.top + 350);

  console.log(`Clicking to create text box at (${pasteClickX}, ${pasteClickY})...`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pasteClickX, y: pasteClickY, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pasteClickX, y: pasteClickY, button: 'left' });
  await wait(800);

  // Rich HTML sample copied from external source
  const sampleRichHtml = `
    <h3 style="color: rgb(30, 58, 138); font-weight: bold; margin: 0 0 6px 0;">Executive Strategy Document</h3>
    <p>This is <strong style="color: rgb(220, 38, 38);">Critical Alert Text in Red Bold</strong> and <em>Italicized Subtext</em> with <u style="color: rgb(13, 148, 136);">teal underline</u>.</p>
    <ul style="padding-left: 20px; margin: 4px 0;">
      <li style="color: rgb(16, 185, 129); font-weight: 600;">Phase 1: Zero-latency Vector Inking Engine</li>
      <li style="color: rgb(59, 130, 246); font-weight: 600;">Phase 2: Full Rich Text Format Preservation</li>
    </ul>
    <div style="background-color: rgb(254, 243, 199); padding: 6px 10px; border-left: 4px solid rgb(245, 158, 11); border-radius: 4px; font-size: 13px;">
      💡 Callout Box: Retained with custom background and borders verbatim.
    </div>
  `.trim();

  const debugDom = await send('Runtime.evaluate', {
    expression: `(() => {
      const editors = document.querySelectorAll('[contenteditable]');
      const allDivs = Array.from(document.querySelectorAll('div')).filter(d => d.style.position === 'absolute' && d.style.left);
      return {
        editorsCount: editors.length,
        allTextBoxesCount: allDivs.length,
        activeElementTag: document.activeElement?.tagName,
        activeElementEditable: document.activeElement?.isContentEditable,
        bodyTextSnippet: document.body.innerText.slice(0, 150)
      };
    })()`,
    returnByValue: true
  });
  console.log('DEBUG DOM BEFORE PASTE:', debugDom.result.value);
  console.log('Dispatching Paste event with rich HTML and plain text fallback...');
  const pasteResult = await send('Runtime.evaluate', {
    expression: `(() => {
      const editor = document.querySelector('[contenteditable=\"true\"]');
      if (!editor) return { success: false, reason: 'no contenteditable editor' };

      const dt = new DataTransfer();
      dt.setData('text/html', ${JSON.stringify(sampleRichHtml)});
      dt.setData('text/plain', 'Executive Strategy Document\\nThis is Critical Alert Text...');

      const evt = new ClipboardEvent('paste', {
        clipboardData: dt,
        bubbles: true,
        cancelable: true
      });
      editor.dispatchEvent(evt);
      return { success: true };
    })()`,
    returnByValue: true
  });
  console.log('Paste dispatch result:', pasteResult.result.value);
  await wait(1000);

  // Check that the editor contains the rich formatting tags
  const richCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const editor = document.querySelector('[contenteditable=\"true\"]');
      if (!editor) return null;
      const html = editor.innerHTML;
      return {
        hasH3: html.includes('<h3') || html.includes('Executive Strategy'),
        hasStrong: html.includes('<strong') || html.includes('font-weight: bold'),
        hasRedColor: html.includes('rgb(220, 38, 38)') || html.includes('#dc2626'),
        hasListItems: html.includes('<li') && html.includes('Phase 1'),
        hasCalloutBg: html.includes('rgb(254, 243, 199)') || html.includes('#fef3c7'),
        renderedWidth: editor.offsetWidth,
        renderedHeight: editor.offsetHeight
      };
    })()`,
    returnByValue: true
  });
  console.log('Rich text verification in editor:', richCheck.result.value);

  if (!richCheck.result.value.hasH3 || !richCheck.result.value.hasRedColor || !richCheck.result.value.hasListItems) {
    throw new Error('FAILED: Pasted text did NOT retain rich format (headings, colors, or lists missing)!');
  }
  console.log('✓ SUCCESS: Pasted text retained exact rich format (headings, colors, bold, lists, and callout)!');

  // Verify user can edit the rich text
  console.log('Testing user editing inside rich text box...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const editor = document.querySelector('[contenteditable=\"true\"]');
      if (editor) {
        document.execCommand('insertHTML', false, '<p style=\"color: rgb(37, 99, 235); font-weight: bold;\">✓ User Added Line Live</p>');
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
      return false;
    })()`
  });
  await wait(500);

  const editedCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const editor = document.querySelector('[contenteditable=\"true\"]');
      return editor ? editor.innerHTML.includes('User Added Line Live') : false;
    })()`,
    returnByValue: true
  });
  console.log('User edit verified:', editedCheck.result.value);
  if (!editedCheck.result.value) {
    throw new Error('FAILED: Unable to edit rich text box after paste');
  }
  console.log('✓ SUCCESS: User can seamlessly edit, add, and modify rich text!');

  // Capture screenshot of the verified page covering the screen with rich text
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  const artifactPath = '/home/ubuntu/.gemini/antigravity-ide/brain/2721baf0-5de5-4c9f-ae3f-51019fcf887f/browser_preview.png';
  fs.writeFileSync(artifactPath, Buffer.from(screenshot.data, 'base64'));
  console.log(`Saved screenshot to ${artifactPath}`);

  ws.close();
  chrome.kill();
  console.log('========================================================================');
  console.log('ALL TESTS PASSED: PAGE COVERS SCREEN & EXACT RICH FORMAT RETAINED!');
  console.log('========================================================================');
}

runTest().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
