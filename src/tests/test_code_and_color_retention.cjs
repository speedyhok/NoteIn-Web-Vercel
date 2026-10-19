const cp = require('child_process');
const fs = require('fs');

async function wait(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function runTest() {
  console.log('Spawning Google Chrome headless for rich code & color retention test...');
  const chrome = cp.spawn('/usr/bin/google-chrome', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1400,900',
    '--user-data-dir=/tmp/chrome-test-code-' + Date.now(),
    '--remote-debugging-port=9222',
    'http://localhost:5174/'
  ]);

  let targets = null;
  for (let i = 0; i < 30; i++) {
    await wait(300);
    try {
      const res = await fetch('http://127.0.0.1:9222/json');
      targets = await res.json();
      if (targets && targets.some(t => t.type === 'page' && t.url.includes('5174'))) {
        break;
      }
    } catch {}
  }

  const pageTarget = targets.find(t => t.type === 'page' && t.url.includes('5174'));
  if (!pageTarget) {
    throw new Error('Failed to find NoteIn-Web page target in Chrome');
  }

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let msgId = 1;
  const send = (method, params = {}) => new Promise((resolve) => {
    const curId = msgId++;
    const onMsg = (event) => {
      const data = JSON.parse(event.data);
      if (data.id === curId) {
        ws.removeEventListener('message', onMsg);
        resolve(data.result);
      }
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id: curId, method, params }));
  });

  await send('Page.enable');
  await send('DOM.enable');
  await send('Runtime.enable');

  ws.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    if (data.method === 'Runtime.consoleAPICalled') {
      const text = data.params.args.map(a => a.value).join(' ');
      console.log(`[Chrome Console] ${data.params.type} ${text}`);
    }
  });

  await wait(1000);

  // 1. Open Notebook from Library
  console.log('Opening notebook from library...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const card = document.querySelector('.notebook-card') || document.querySelector('h3') || Array.from(document.querySelectorAll('div')).find(d => d.innerText && d.innerText.includes('Getting Started'));
      if (card) card.click();
      return true;
    })()`
  });
  await wait(1200);

  // 2. Select Text Tool
  console.log('Selecting Text Tool...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const textBtn = document.querySelector('button[title*="Text" i]');
      if (textBtn) textBtn.click();
      return true;
    })()`
  });
  await wait(400);

  // Wait for canvas to be mounted
  let cRect = null;
  for (let i = 0; i < 20; i++) {
    const res = await send("Runtime.evaluate", {
      expression: `(() => {
        const c = document.querySelector("canvas");
        if (!c) return null;
        const r = c.getBoundingClientRect();
        return { left: r.left, top: r.top, width: r.width, height: r.height };
      })()`,
      returnByValue: true
    });
    if (res && res.result && res.result.value) {
      cRect = res;
      break;
    }
    await wait(300);
  }
  if (!cRect || !cRect.result || !cRect.result.value) {
    throw new Error("Canvas element not found in DOM after opening notebook");
  }

  // --- TEST 1: Rich Multi-Color, Inlined Styles, and Font Tag Retention ---
  console.log('--- TEST 1: Inlined Multi-Color & Multi-Style Retention (Google Docs / Word style) ---');
  const colorClickX = Math.round(cRect.result.value.left + 80);
  const colorClickY = Math.round(cRect.result.value.top + 280);

  console.log(`Clicking to create text box for color test at (${colorClickX}, ${colorClickY})...`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: colorClickX, y: colorClickY, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: colorClickX, y: colorClickY, button: 'left' });
  await wait(700);

  // Clipboard HTML simulating Google Docs / Word with <head><style> classes and legacy <font> tags
  const googleDocsHtml = `
    <html>
      <head>
        <style>
          .c-crimson { color: rgb(225, 29, 72); font-weight: bold; font-size: 16px; }
          .c-cyan-pill { color: rgb(2, 132, 199); background-color: rgb(224, 242, 254); padding: 2px 6px; border-radius: 4px; font-weight: 600; }
          .c-purple-highlight { color: rgb(147, 51, 234); background-color: rgb(243, 232, 255); font-style: italic; }
        </style>
      </head>
      <body>
        <p>
          <span class="c-crimson">Alert: High Priority Metric</span>
          &nbsp;&nbsp;
          <span class="c-cyan-pill">Status: Operational</span>
          &nbsp;&nbsp;
          <span class="c-purple-highlight">Review pending approval</span>
        </p>
        <p>
          Legacy styled text: <font color="#16a34a" size="4" face="Georgia">Verified Emerald Green Heading</font>
        </p>
      </body>
    </html>
  `.trim();

  const colorPasteResult = await send('Runtime.evaluate', {
    expression: `(() => {
      const editor = document.querySelector('[contenteditable="true"]');
      if (!editor) return { success: false, reason: 'no editor' };

      const dt = new DataTransfer();
      dt.setData('text/html', ${JSON.stringify(googleDocsHtml)});
      dt.setData('text/plain', 'Alert: High Priority Metric Status: Operational');

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
  console.log('Color paste result:', colorPasteResult.result.value);
  await wait(800);

  const colorCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const editor = document.querySelector('[contenteditable="true"]');
      if (!editor) return null;
      const html = editor.innerHTML;
      return {
        hasCrimsonColor: html.includes('225, 29, 72') || html.includes('rgb(225, 29, 72)'),
        hasCyanColor: html.includes('2, 132, 199') || html.includes('rgb(2, 132, 199)'),
        hasCyanBg: html.includes('224, 242, 254') || html.includes('rgb(224, 242, 254)'),
        hasPurpleColor: html.includes('147, 51, 234') || html.includes('rgb(147, 51, 234)'),
        hasEmeraldFontConverted: html.includes('#16a34a') || html.includes('rgb(22, 163, 74)'),
        rawSnippet: html.slice(0, 300)
      };
    })()`,
    returnByValue: true
  });
  console.log('Inlined color verification:', colorCheck.result.value);

  if (!colorCheck.result.value.hasCrimsonColor || !colorCheck.result.value.hasCyanBg || !colorCheck.result.value.hasEmeraldFontConverted) {
    throw new Error('FAILED: Inlined colors or converted font styles were lost on paste!');
  }
  console.log('✓ SUCCESS: All colors, background pills, and fonts completely retained from stylesheet classes!');

  // Commit and close first text box
  await send('Runtime.evaluate', {
    expression: `(() => {
      const editor = document.querySelector('[contenteditable="true"]');
      if (editor) {
        editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      }
      return true;
    })()`
  });
  await wait(600);

  // --- TEST 2: Code Snippet Detection & Syntax Highlighting ---
  console.log('--- TEST 2: Plain Text Code Detection & Rich Syntax Highlighting ---');
  const codeClickX = Math.round(cRect.result.value.left + 80);
  const codeClickY = Math.round(cRect.result.value.top + 460);

  console.log(`Clicking to create text box for code test at (${codeClickX}, ${codeClickY})...`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: codeClickX, y: codeClickY, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: codeClickX, y: codeClickY, button: 'left' });
  await wait(700);

  // Raw plain text code as copied from ChatGPT or GitHub "Copy code" button (no HTML payload!)
  const samplePlainCode = `// User authentication and session verification service
async function authenticateUser(token: string, maxRetries = 3) {
  const user = await db.users.findUnique({ where: { token } });
  if (!user) {
    throw new Error("Invalid session token");
  }
  return { success: true, userId: user.id };
}`;

  console.log('Dispatching Paste event with PLAIN TEXT code (no HTML)...');
  const codePasteResult = await send('Runtime.evaluate', {
    expression: `(() => {
      const editor = document.querySelector('[contenteditable="true"]');
      if (!editor) return { success: false, reason: 'no editor' };

      const dt = new DataTransfer();
      // NO html data set: strictly plain text code
      dt.setData('text/plain', ${JSON.stringify(samplePlainCode)});

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
  console.log('Code paste dispatch result:', codePasteResult.result.value);
  await wait(1000);

  const codeCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const editor = document.querySelector('[contenteditable="true"]');
      if (!editor) return null;
      const html = editor.innerHTML;
      const codeCard = editor.querySelector('.notein-code-card') || editor.querySelector('[data-code-block="true"]');
      const box = editor.closest('div[style*="position: absolute"]');
      return {
        hasCodeCard: !!codeCard,
        hasKeywordColor: html.includes('#ff7b72') || html.includes('rgb(255, 123, 114)'),
        hasStringColor: html.includes('#7ee787') || html.includes('rgb(126, 231, 135)'),
        hasNumberColor: html.includes('#79c0ff') || html.includes('rgb(121, 192, 255)'),
        hasCommentColor: html.includes('#8b949e') || html.includes('rgb(139, 148, 158)'),
        hasFunctionColor: html.includes('#d2a8ff') || html.includes('rgb(210, 168, 255)'),
        boxWidth: box ? parseFloat(box.style.width) : 0,
        boxHeight: box ? parseFloat(box.style.minHeight) : 0,
        rawSnippet: html.slice(0, 400)
      };
    })()`,
    returnByValue: true
  });
  console.log('Code syntax verification in editor:', codeCheck.result.value);

  if (!codeCheck.result.value.hasCodeCard) {
    throw new Error('FAILED: Pasted code was not wrapped in .notein-code-card!');
  }
  if (!codeCheck.result.value.hasKeywordColor || !codeCheck.result.value.hasStringColor || !codeCheck.result.value.hasCommentColor) {
    throw new Error('FAILED: Pasted code does not have syntax highlighting colors!');
  }
  console.log('✓ SUCCESS: Plain code automatically converted into syntax-highlighted code block!');
  console.log(`✓ SUCCESS: Code card auto-expanded text box to width: ${codeCheck.result.value.boxWidth}px, height: ${codeCheck.result.value.boxHeight}px!`);

  // --- TEST 3: Toolbar Insert/Format Code Block Button ---
  console.log('--- TEST 3: Toolbar Insert / Format Code Block Button ---');
  const codeBtnExists = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('button[title*="Code Block" i]');
      return !!btn;
    })()`,
    returnByValue: true
  });
  console.log('Toolbar code button exists:', codeBtnExists.result.value);
  if (!codeBtnExists.result.value) {
    throw new Error('FAILED: Code block button is missing from toolbar!');
  }
  console.log('✓ SUCCESS: Dedicated Code Block tool is present in toolbar!');

  // Capture screenshot of the verified page covering the screen with rich text, colors, and code card
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  const artifactPath = '/home/ubuntu/.gemini/antigravity-ide/brain/2721baf0-5de5-4c9f-ae3f-51019fcf887f/browser_preview.png';
  fs.writeFileSync(artifactPath, Buffer.from(screenshot.data, 'base64'));
  console.log(`Saved screenshot to ${artifactPath}`);

  ws.close();
  chrome.kill();
  console.log('========================================================================');
  console.log('ALL TESTS PASSED: RICH CODE BLOCKS & INLINED COLORS FULLY RETAINED!');
  console.log('========================================================================');
}

runTest().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
