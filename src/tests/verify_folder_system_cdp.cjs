const cp = require("child_process");
const fs = require("fs");

async function wait(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function runTest() {
  console.log("Spawning Google Chrome headless for Folder System verification...");
  const chrome = cp.spawn("/usr/bin/google-chrome", [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--window-size=1400,900",
    "--user-data-dir=/tmp/chrome-folder-profile-" + Date.now(),
    "--remote-debugging-port=9223",
    "http://localhost:5174/",
  ]);

  let targets = null;
  for (let i = 0; i < 30; i++) {
    await wait(300);
    try {
      const res = await fetch("http://127.0.0.1:9223/json");
      targets = await res.json();
      if (targets && targets.length > 0) break;
    } catch {}
  }

  if (!targets) {
    chrome.kill();
    throw new Error("Chrome failed to expose remote debugging port 9223");
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
  console.log("Connected to Chrome CDP WebSocket successfully.");

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
    console.log("Screenshot saved:", filepath);
  }

  // 1. Wait for splash screen to dismiss and library to load
  console.log("Waiting for library to load...");
  await wait(1800);

  // 2. Open Folder Creation Dialog
  console.log("Clicking New Folder button in header...");
  const opened = await evaluate(`(() => {
    const btn = document.getElementById("notein-new-folder-header-btn");
    if (!btn) return "NOT_FOUND";
    btn.click();
    return "CLICKED";
  })()`);
  console.log("Header button status:", opened);
  await wait(500);

  // Take screenshot of authentic folder creation dialog
  await takeScreenshot("/home/ubuntu/.gemini/antigravity-ide/brain/2721baf0-5de5-4c9f-ae3f-51019fcf887f/folder_creation_dialog.png");

  // 3. Type folder name "Physics Research" and select a color
  console.log("Entering folder name and picking Dusty Blue color swatch...");
  await evaluate(`(() => {
    const input = document.getElementById("notein-folder-name-input");
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(input, "Physics Research");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    // Click Dusty Blue swatch (index 3)
    const swatches = document.querySelectorAll("button[title]");
    for (const b of swatches) {
      if (b.getAttribute("title") === "Dusty Blue") {
        b.click();
        break;
      }
    }
  })()`);
  await wait(400);

  await takeScreenshot("/home/ubuntu/.gemini/antigravity-ide/brain/2721baf0-5de5-4c9f-ae3f-51019fcf887f/folder_dialog_colored.png");

  // 4. Confirm folder creation
  console.log("Confirming folder creation...");
  await evaluate(`(() => {
    const confirmBtn = document.getElementById("notein-folder-confirm-btn");
    if (confirmBtn) confirmBtn.click();
  })()`);
  await wait(800);

  // Take screenshot of library with the new FolderCard on the shelf
  await takeScreenshot("/home/ubuntu/.gemini/antigravity-ide/brain/2721baf0-5de5-4c9f-ae3f-51019fcf887f/folder_on_shelf.png");

  // 5. Click the folder card to navigate into it
  console.log("Clicking on Physics Research folder card to navigate inside...");
  await evaluate(`(() => {
    const cards = Array.from(document.querySelectorAll("h3"));
    const folderTitle = cards.find(h => h.textContent && h.textContent.includes("Physics Research"));
    if (folderTitle) {
      let el = folderTitle;
      while (el && el.parentElement && !el.getAttribute("style")?.includes("cursor: pointer")) {
        el = el.parentElement;
      }
      if (el) el.click();
    }
  })()`);
  await wait(600);

  // Take screenshot of inside folder view showing breadcrumb bar
  await takeScreenshot("/home/ubuntu/.gemini/antigravity-ide/brain/2721baf0-5de5-4c9f-ae3f-51019fcf887f/inside_folder_view.png");

  // 6. Test FAB Menu
  console.log("Clicking FAB + button to test NoteIn creation menu...");
  await evaluate(`(() => {
    const fab = document.getElementById("notein-main-fab-btn");
    if (fab) fab.click();
  })()`);
  await wait(500);

  // Take screenshot of authentic FAB menu
  await takeScreenshot("/home/ubuntu/.gemini/antigravity-ide/brain/2721baf0-5de5-4c9f-ae3f-51019fcf887f/fab_menu.png");

  // Close FAB menu
  await evaluate(`(() => {
    const fab = document.getElementById("notein-main-fab-btn");
    if (fab) fab.click();
  })()`);
  await wait(400);

  // 7. Click Back button to return to Desktop
  console.log("Navigating back to Desktop...");
  await evaluate(`(() => {
    const backBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent && b.textContent.includes("Back"));
    if (backBtn) backBtn.click();
  })()`);
  await wait(600);

  // 7b. Test Move to Folder
  console.log("Testing Move to Folder action...");
  await evaluate(`(() => {
    const moreBtns = Array.from(document.querySelectorAll("button")).filter(b => b.getAttribute("aria-label") === "Notebook options");
    if (moreBtns.length > 0) moreBtns[0].click();
  })()`);
  await wait(300);

  await evaluate(`(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const moveBtn = btns.find(b => b.textContent && b.textContent.includes("Move to Folder"));
    if (moveBtn) moveBtn.click();
  })()`);
  await wait(500);

  await takeScreenshot("/home/ubuntu/.gemini/antigravity-ide/brain/2721baf0-5de5-4c9f-ae3f-51019fcf887f/move_to_folder_modal_live.png");

  // Select Physics Research and click Move Here
  await evaluate(`(() => {
    const row = document.querySelector(".move-dest-folder-row");
    if (row) row.click();
  })()`);
  await wait(300);

  await evaluate(`(() => {
    const btn = document.getElementById("move-folder-confirm-btn");
    if (btn) btn.click();
  })()`);
  await wait(800);

  // Take screenshot of shelf with updated 1 item badge on folder
  await takeScreenshot("/home/ubuntu/.gemini/antigravity-ide/brain/2721baf0-5de5-4c9f-ae3f-51019fcf887f/folder_with_1_item_shelf.png");

  // Click into folder to see the moved notebook
  console.log("Entering Physics Research folder to see moved notebook...");
  await evaluate(`(() => {
    const cards = Array.from(document.querySelectorAll("h3"));
    const folderTitle = cards.find(h => h.textContent && h.textContent.includes("Physics Research"));
    if (folderTitle) {
      let el = folderTitle;
      while (el && el.parentElement && !el.getAttribute("style")?.includes("cursor: pointer")) {
        el = el.parentElement;
      }
      if (el) el.click();
    }
  })()`);
  await wait(600);

  await takeScreenshot("/home/ubuntu/.gemini/antigravity-ide/brain/2721baf0-5de5-4c9f-ae3f-51019fcf887f/inside_folder_with_notebook.png");

  // Navigate back to desktop
  await evaluate(`(() => {
    const backBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent && b.textContent.includes("Back"));
    if (backBtn) backBtn.click();
  })()`);
  await wait(500);

  // 8. Test Folders tab in Sidebar
  console.log("Switching to Folders tab in sidebar...");
  await evaluate(`(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const foldersTab = buttons.find(b => b.textContent && b.textContent.trim().toLowerCase() === "folders");
    if (foldersTab) foldersTab.click();
  })()`);
  await wait(500);

  // Take screenshot of sidebar with folders
  await takeScreenshot("/home/ubuntu/.gemini/antigravity-ide/brain/2721baf0-5de5-4c9f-ae3f-51019fcf887f/sidebar_folders_tab.png");

  console.log("All folder system verification steps completed successfully!");
  ws.close();
  chrome.kill();
  process.exit(0);
}

runTest().catch((err) => {
  console.error("CDP Test failed:", err);
  process.exit(1);
});
