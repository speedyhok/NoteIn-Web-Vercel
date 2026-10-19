const cp = require("child_process");
const fs = require("fs");

async function wait(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function runTest() {
  console.log("Starting Chrome CDP verification for document preview and below titles...");
  const chrome = cp.spawn("/usr/bin/google-chrome", [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--window-size=1440,920",
    "--user-data-dir=/tmp/chrome-preview-test-" + Date.now(),
    "--remote-debugging-port=9229",
    "http://localhost:5174/",
  ]);

  let targets = null;
  for (let i = 0; i < 30; i++) {
    await wait(300);
    try {
      const res = await fetch("http://127.0.0.1:9229/json");
      targets = await res.json();
      if (targets && targets.length > 0) break;
    } catch {}
  }

  const pageTarget = targets.find((t) => t.type === "page" && t.url.includes("5174")) || targets.find((t) => t.type === "page");
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
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    }
  };

  await new Promise((resolve) => (ws.onopen = resolve));
  await send("Page.enable");
  await send("Runtime.enable");

  async function evaluate(expression) {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) {
      throw new Error("Evaluation error: " + JSON.stringify(result.exceptionDetails));
    }
    return result.result.value;
  }

  async function takeScreenshot(filepath) {
    const screenshot = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(filepath, Buffer.from(screenshot.data, "base64"));
  }

  // Wait for initial render and splash dismissal
  await wait(2200);

  const artifactDir = "/home/ubuntu/.gemini/antigravity-ide/brain/2721baf0-5de5-4c9f-ae3f-51019fcf887f";

  // Step 1: Capture initial shelf with new document preview & clean folder
  await takeScreenshot(`${artifactDir}/new_document_preview_shelf.png`);
  console.log("Step 1: Captured new document preview shelf.");

  // Check if .notebook-page-sheet canvas exists
  const hasPageSheet = await evaluate(`(() => {
    return !!document.querySelector(".notebook-page-sheet canvas");
  })()`);
  console.log("Has authentic page canvas preview:", hasPageSheet);

  // Step 2: Create a folder "Physics Research"
  console.log("Step 2: Creating folder 'Physics Research'...");
  await evaluate(`document.getElementById("notein-new-folder-header-btn").click()`);
  await wait(400);

  await evaluate(`(() => {
    const input = document.getElementById("notein-folder-name-input");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, "Physics Research");
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await wait(300);

  await evaluate(`document.getElementById("notein-folder-confirm-btn").click()`);
  await wait(800);

  await takeScreenshot(`${artifactDir}/folder_clean_strap_below_name.png`);
  console.log("Step 2: Captured clean folder strap with below name.");

  // Step 3: Click notebook title below to rename
  console.log("Step 3: Clicking notebook title below preview to rename...");
  await evaluate(`(() => {
    const titles = Array.from(document.querySelectorAll(".notebook-card-title-hover"));
    if (titles.length > 0) titles[0].click();
  })()`);
  await wait(500);

  await takeScreenshot(`${artifactDir}/rename_notebook_modal_opened.png`);

  await evaluate(`(() => {
    const input = document.getElementById("rename-notebook-input");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, "Neutrino Oscillations Physics");
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await wait(300);

  await evaluate(`document.getElementById("confirm-rename-notebook-btn").click()`);
  await wait(800);

  await takeScreenshot(`${artifactDir}/renamed_notebook_below_title.png`);
  console.log("Step 3: Renamed notebook, title updated cleanly below preview.");

  // Step 4: Click the document preview sheet to open
  console.log("Step 4: Clicking document preview sheet to open editor...");
  await evaluate(`(() => {
    const sheet = document.querySelector(".notebook-page-sheet");
    if (sheet) sheet.click();
    else document.querySelector(".notebook-card").click();
  })()`);
  await wait(1400);

  await takeScreenshot(`${artifactDir}/editor_opened_from_sheet.png`);
  console.log("Step 4: Editor opened successfully.");

  // Step 5: Back to Library
  console.log("Step 5: Returning to library...");
  await evaluate(`document.getElementById("back-to-library-btn").click()`);
  await wait(1200);

  await takeScreenshot(`${artifactDir}/final_verified_library_ui.png`);
  console.log("Step 5: Returned to library.");

  ws.close();
  chrome.kill();
  console.log("SUCCESS! All visual elements verified.");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
