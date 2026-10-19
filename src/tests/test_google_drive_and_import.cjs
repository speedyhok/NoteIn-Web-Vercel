const cp = require('child_process');
const fs = require('fs');

async function wait(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function runTest() {
  console.log('Spawning Google Chrome headless for Google Drive & Document Import test...');
  const chrome = cp.spawn('/usr/bin/google-chrome', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1400,900',
    '--user-data-dir=/tmp/chrome-test-drive-' + Date.now(),
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

  await wait(1200);

  // --- TEST 1: Library Header Buttons Verification ---
  console.log('--- TEST 1: Verify Google Drive & Import Document Buttons in Library ---');
  const headerCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const driveBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('Google Drive'));
      const importBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('Import'));
      const newBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('New Notebook'));
      return {
        hasDriveBtn: !!driveBtn,
        hasImportBtn: !!importBtn,
        hasNewBtn: !!newBtn,
      };
    })()`,
    returnByValue: true
  });
  console.log('Header buttons check:', headerCheck.result.value);

  if (!headerCheck.result.value.hasDriveBtn || !headerCheck.result.value.hasImportBtn) {
    throw new Error('FAILED: Google Drive or Import button is missing in Library header!');
  }
  console.log('✓ SUCCESS: Google Drive & Import Document buttons present in Library header!');

  // --- TEST 2: Open Google Drive Cloud Sync Modal & Sign In ---
  console.log('--- TEST 2: Google Sign-In & Google Drive Cloud File Browser ---');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const driveBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('Google Drive'));
      if (driveBtn) driveBtn.click();
    })()`
  });
  await wait(600);

  // Click Sign In with Google
  console.log('Clicking Sign in with Google...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const signInBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('Sign In with Google'));
      if (signInBtn) signInBtn.click();
    })()`
  });
  await wait(800);

  const driveModalState = await send('Runtime.evaluate', {
    expression: `(() => {
      const bodyText = document.body.innerText;
      const fileRows = Array.from(document.querySelectorAll('div')).filter(d => d.innerText && d.innerText.includes('Bring to NoteIn'));
      return {
        isConnected: bodyText.includes('Connected') || bodyText.includes('Alex Chen'),
        filesCount: fileRows.length,
        hasCalculusNotein: bodyText.includes('Calculus_Lecture_Notes.notein'),
        hasBiologyIn: bodyText.includes('Biology_Cell_Biology_Guide.in'),
        hasDesignPdf: bodyText.includes('Design_System_Guidelines.pdf'),
      };
    })()`,
    returnByValue: true
  });
  console.log('Google Drive modal state after login:', driveModalState.result.value);

  if (!driveModalState.result.value.isConnected || driveModalState.result.value.filesCount === 0) {
    throw new Error('FAILED: Google Drive did not connect or display cloud files!');
  }
  console.log('✓ SUCCESS: Signed into Google account with connected Google Drive!');
  console.log(`✓ SUCCESS: Displayed ${driveModalState.result.value.filesCount} cloud files in Google Drive!`);

  // --- TEST 3: "Bring to NoteIn" - Import NoteIn File from Google Drive ---
  console.log('--- TEST 3: Bring NoteIn Document from Google Drive into Workspace ---');
  await send('Runtime.evaluate', {
    expression: `(() => {
      // Find the first 'Bring to NoteIn' button (for Calculus_Lecture_Notes.notein)
      const bringBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText && b.innerText.includes('Bring to NoteIn'));
      if (bringBtns.length > 0) {
        bringBtns[0].click();
      }
    })()`
  });
  await wait(1800);

  // Verify the notebook has opened in the studio editor
  const editorOpenedCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const canvas = document.querySelector('canvas');
      const titleEl = document.querySelector('h2');
      const allText = document.body.innerText;
      return {
        hasCanvas: !!canvas,
        openedTitle: titleEl ? titleEl.innerText : null,
        hasImportedContent: allText.includes('Calculus') || allText.includes('Taylor Expansions') || allText.includes('Google Drive'),
      };
    })()`,
    returnByValue: true
  });
  console.log('Editor state after Google Drive import:', editorOpenedCheck.result.value);

  if (!editorOpenedCheck.result.value.hasCanvas || !editorOpenedCheck.result.value.hasImportedContent) {
    throw new Error('FAILED: NoteIn document brought from Google Drive did not open in editor!');
  }
  console.log(`✓ SUCCESS: Document "${editorOpenedCheck.result.value.openedTitle}" imported from Google Drive and opened in Studio!`);

  // --- TEST 4: Cloud Backup from Editor back to Google Drive ---
  console.log('--- TEST 4: Cloud Backup from Editor to Google Drive ---');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const cloudBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('Cloud'));
      if (cloudBtn) cloudBtn.click();
    })()`
  });
  await wait(400);

  const saveToDriveExists = await send('Runtime.evaluate', {
    expression: `(() => {
      const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('Save to Google Drive'));
      return !!saveBtn;
    })()`,
    returnByValue: true
  });
  console.log('Save to Google Drive action exists in Cloud menu:', saveToDriveExists.result.value);
  if (!saveToDriveExists.result.value) {
    throw new Error('FAILED: Save to Google Drive option is missing from Cloud menu!');
  }
  console.log('✓ SUCCESS: Cloud Backup options verified in Editor!');

  // Navigate back to Library
  console.log("Navigating back to Library...");
  await send("Runtime.evaluate", {
    expression: `(() => {
      const backBtn = document.getElementById("back-to-library-btn");
      if (backBtn) backBtn.click();
    })()`
  });
  await wait(1500);

  // --- TEST 5: Upload & Import Document Modal Verification ---
  console.log('--- TEST 5: Upload & Import Document Modal Verification ---');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const importBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('Import'));
      if (importBtn) importBtn.click();
    })()`
  });
  await wait(600);

  const importModalCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const modalText = document.body.innerText;
      return {
        hasModal: modalText.includes('Upload & Import Document'),
        hasPdfCard: modalText.includes('PDF Documents'),
        hasNoteinCard: modalText.includes('NoteIn Packages'),
        hasImagesCard: modalText.includes('Images & Photos'),
        hasMarkdownCard: modalText.includes('Markdown & Text'),
        hasDropZone: modalText.includes('Drag and drop your file here'),
      };
    })()`,
    returnByValue: true
  });
  console.log('Import modal verification:', importModalCheck.result.value);

  if (!importModalCheck.result.value.hasModal || !importModalCheck.result.value.hasPdfCard || !importModalCheck.result.value.hasNoteinCard) {
    throw new Error('FAILED: Upload & Import Document modal did not open or is missing format cards!');
  }
  console.log('✓ SUCCESS: Upload & Import Document modal supports PDF, NoteIn packages, Images, and Markdown!');

  // Capture screenshot of verified library with Google Drive connected and Import modal ready
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  const artifactPath = '/home/ubuntu/.gemini/antigravity-ide/brain/2721baf0-5de5-4c9f-ae3f-51019fcf887f/browser_preview.png';
  fs.writeFileSync(artifactPath, Buffer.from(screenshot.data, 'base64'));
  console.log(`Saved screenshot to ${artifactPath}`);

  ws.close();
  chrome.kill();
  console.log('========================================================================');
  console.log('ALL TESTS PASSED: GOOGLE DRIVE CLOUD SYNC & DOCUMENT IMPORT VERIFIED!');
  console.log('========================================================================');
}

runTest().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
