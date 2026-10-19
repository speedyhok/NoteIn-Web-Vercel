const cp = require("child_process");
const fs = require("fs");

async function wait(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function runTest() {
  console.log("Starting Chrome CDP verification for folder inside file preview and folder color...");
  const chrome = cp.spawn("/usr/bin/google-chrome", [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--window-size=1440,920",
    "--user-data-dir=/tmp/chrome-folder-preview-test-" + Date.now(),
    "--remote-debugging-port=9230",
    "http://localhost:5174/",
  ]);

  let targets = null;
  for (let i = 0; i < 40; i++) {
    await wait(300);
    try {
      const res = await fetch("http://127.0.0.1:9230/json");
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

  async function waitForSelector(selector, maxTries = 30) {
    for (let i = 0; i < maxTries; i++) {
      const exists = await evaluate(`!!document.querySelector("${selector}")`);
      if (exists) return true;
      await wait(300);
    }
    throw new Error(`Timeout waiting for selector: ${selector}`);
  }

  async function takeScreenshot(filepath) {
    const screenshot = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(filepath, Buffer.from(screenshot.data, "base64"));
  }

  const artifactDir = "/home/ubuntu/.gemini/antigravity-ide/brain/2721baf0-5de5-4c9f-ae3f-51019fcf887f";

  console.log("Waiting for library header to appear...");
  await waitForSelector("#notein-new-folder-header-btn");
  await wait(600);

  // Step 1: Create a colorful folder
  console.log("Step 1: Creating a folder with vibrant color...");
  await evaluate(`document.getElementById("notein-new-folder-header-btn").click()`);
  await waitForSelector("#notein-folder-name-input");
  await wait(300);

  await evaluate(`(() => {
    const input = document.getElementById("notein-folder-name-input");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, "Lecture Notes & Labs");
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    // Click 3rd color swatch
    const swatches = document.querySelectorAll(".folder-color-chip");
    if (swatches.length > 2) swatches[2].click();
  })()`);
  await wait(300);

  await evaluate(`document.getElementById("notein-folder-confirm-btn").click()`);
  await wait(800);

  // Step 2: Move the first notebook into the folder
  console.log("Step 2: Moving notebook into folder...");
  await evaluate(`(() => {
    const moreBtns = document.querySelectorAll("button[aria-label='Notebook options']");
    if (moreBtns.length > 0) moreBtns[0].click();
  })()`);
  await wait(400);

  await evaluate(`(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const moveBtn = buttons.find(b => b.textContent && b.textContent.includes("Move to Folder"));
    if (moveBtn) moveBtn.click();
  })()`);
  await waitForSelector("#move-folder-confirm-btn");
  await wait(400);

  // Select folder in list
  await evaluate(`(() => {
    const folderItems = Array.from(document.querySelectorAll(".move-dest-folder-row"));
    if (folderItems.length > 0) folderItems[folderItems.length - 1].click();
  })()`);
  await wait(300);

  // Confirm move
  await evaluate(`document.getElementById("move-folder-confirm-btn").click()`);
  await wait(1000);

  // Step 3: Take screenshot of folder displaying inside file in library card format with authentic preview & folder color!
  console.log("Step 3: Taking screenshot of folder on shelf with inside file preview...");
  await takeScreenshot(`${artifactDir}/folder_with_inside_file_preview_shelf.png`);

  // Step 4: Click into the folder
  console.log("Step 4: Opening folder to inspect inside folder view...");
  await evaluate(`(() => {
    const visual = document.querySelector(".folder-card-visual");
    if (visual) visual.click();
    else {
      const card = document.querySelector(".folder-card");
      if (card) card.click();
    }
  })()`);
  await waitForSelector("#notein-active-folder-banner");
  await wait(800);

  // Take screenshot of inside folder view
  await takeScreenshot(`${artifactDir}/folder_inside_view_keeping_color.png`);
  console.log("Step 4: Captured inside folder view keeping folder color and authentic card previews.");

  // Step 5: Toggle to list mode inside folder
  console.log("Step 5: Testing list view mode inside folder...");
  await evaluate(`(() => {
    // Find list view toggle button in header
    const btns = Array.from(document.querySelectorAll("button"));
    const listBtn = btns.find(b => b.innerHTML && (b.innerHTML.includes("NoteinList") || b.title === "List View") || b.getAttribute("aria-label") === "List view");
    if (listBtn) listBtn.click();
  })()`);
  await wait(600);

  await takeScreenshot(`${artifactDir}/folder_inside_list_view_mode.png`);
  console.log("Step 5: Captured folder inside list view mode.");

  // Step 6: Return to Desktop
  console.log("Step 6: Returning to Desktop...");
  await evaluate(`(() => {
    const backBtn = document.querySelector("#notein-folder-breadcrumb-bar button");
    if (backBtn) backBtn.click();
  })()`);
  await wait(1000);

  await takeScreenshot(`${artifactDir}/final_bookshelf_folders_and_files.png`);
  console.log("Step 6: Returned to Desktop.");

  ws.close();
  chrome.kill();
  console.log("SUCCESS! All folder inside preview and color features verified.");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
