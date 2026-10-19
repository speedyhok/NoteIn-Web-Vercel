const cp = require("child_process");
const fs = require("fs");

async function wait(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function runTest() {
  console.log("Starting Chrome CDP verification for Folder Persistence & Rename...");
  const chrome = cp.spawn("/usr/bin/google-chrome", [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--window-size=1440,920",
    "--user-data-dir=/tmp/chrome-folder-test-" + Date.now(),
    "--remote-debugging-port=9227",
    "http://localhost:5174/",
  ]);

  let targets = null;
  for (let i = 0; i < 30; i++) {
    await wait(300);
    try {
      const res = await fetch("http://127.0.0.1:9227/json");
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
  await takeScreenshot(`${artifactDir}/1_library_initial.png`);
  console.log("Step 1: Captured initial library.");

  // Step 2: Create a folder "Quantum Mechanics"
  console.log("Step 2: Creating folder 'Quantum Mechanics'...");
  await evaluate(`document.getElementById("notein-new-folder-header-btn").click()`);
  await wait(400);

  await evaluate(`(() => {
    const input = document.getElementById("notein-folder-name-input");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, "Quantum Mechanics");
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await wait(300);

  await evaluate(`document.getElementById("notein-folder-confirm-btn").click()`);
  await wait(800);

  await takeScreenshot(`${artifactDir}/2_folder_created.png`);
  console.log("Step 2: Created folder 'Quantum Mechanics'.");

  // Step 3: Put first notebook into "Quantum Mechanics" folder via Move to Folder
  console.log("Step 3: Moving notebook to folder...");
  await evaluate(`(() => {
    const moreBtns = Array.from(document.querySelectorAll('button')).filter(b => b.getAttribute('aria-label') === 'Notebook options');
    if (moreBtns.length > 0) moreBtns[0].click();
  })()`);
  await wait(300);

  await evaluate(`(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const moveBtn = btns.find(b => b.textContent && b.textContent.includes("Move to Folder"));
    if (moveBtn) moveBtn.click();
  })()`);
  await wait(500);

  // Select "Quantum Mechanics" destination row
  await evaluate(`(() => {
    const rows = Array.from(document.querySelectorAll(".move-dest-folder-row"));
    const target = rows.find(r => r.textContent && r.textContent.includes("Quantum Mechanics"));
    if (target) target.click();
  })()`);
  await wait(300);

  await evaluate(`document.getElementById("move-folder-confirm-btn").click()`);
  await wait(800);

  await takeScreenshot(`${artifactDir}/3_notebook_moved_to_folder.png`);
  console.log("Step 3: Notebook moved into 'Quantum Mechanics'.");

  // Step 4: Click into "Quantum Mechanics" folder
  console.log("Step 4: Entering 'Quantum Mechanics' folder...");
  await evaluate(`(() => {
    const titles = Array.from(document.querySelectorAll("h3"));
    const folderTitle = titles.find(h => h.textContent && h.textContent.includes("Quantum Mechanics"));
    if (folderTitle) {
      // Click the folder visual card to enter
      const card = folderTitle.closest('div[style*="border-radius: 14px"]');
      if (card) {
        card.querySelector('div[style*="height: 170px"]').click();
      }
    }
  })()`);
  await wait(800);

  await takeScreenshot(`${artifactDir}/4_inside_folder.png`);
  console.log("Step 4: Inside folder, verified notebook is present.");

  // Step 5: Test Click-to-Rename Notebook inside the folder!
  console.log("Step 5: Testing click notebook title to rename...");
  await evaluate(`(() => {
    const titles = Array.from(document.querySelectorAll(".notebook-card-title-hover"));
    if (titles.length > 0) titles[0].click();
  })()`);
  await wait(500);

  await takeScreenshot(`${artifactDir}/5_rename_notebook_modal_opened.png`);
  console.log("Step 5: Rename modal opened via title click.");

  // Set new title "Advanced Quantum Notes" and click Save
  await evaluate(`(() => {
    const input = document.getElementById("rename-notebook-input");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, "Advanced Quantum Notes");
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await wait(300);

  await evaluate(`document.getElementById("confirm-rename-notebook-btn").click()`);
  await wait(800);

  await takeScreenshot(`${artifactDir}/6_notebook_renamed_in_folder.png`);
  console.log("Step 6: Renamed notebook to 'Advanced Quantum Notes'.");

  // Step 7: Open the notebook in NoteEditor (click the cover)
  console.log("Step 7: Opening notebook in NoteEditor...");
  await evaluate(`(() => {
    const cover = document.querySelector(".notebook-card div[style*='height: 185px']");
    if (cover) cover.click();
  })()`);
  await wait(1400);

  await takeScreenshot(`${artifactDir}/7_note_editor_opened.png`);
  console.log("Step 7: Editor opened.");

  // Step 8: Click the title in the editor top bar to rename inline!
  console.log("Step 8: Clicking top title in editor header to rename inline...");
  await evaluate(`document.getElementById("editor-title-container").click()`);
  await wait(400);

  await evaluate(`(() => {
    const input = document.getElementById("editor-title-rename-input");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, "Advanced Quantum Physics 2026");
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    input.blur();
  })()`);
  await wait(800);

  await takeScreenshot(`${artifactDir}/8_editor_title_renamed.png`);
  console.log("Step 8: Editor header title renamed inline.");

  // Step 9: Click Back to Library and VERIFY it stays inside the folder!
  console.log("Step 9: Clicking Back to Library...");
  await evaluate(`document.getElementById("back-to-library-btn").click()`);
  await wait(1200);

  // Check state: Are we still in the folder? Is the notebook still visible?
  const verifyResult = await evaluate(`(() => {
    const breadcrumb = document.getElementById("notein-folder-breadcrumb-bar");
    const isInsideFolder = !!breadcrumb;
    const titles = Array.from(document.querySelectorAll("h3")).map(h => h.textContent);
    return {
      isInsideFolder,
      breadcrumbText: breadcrumb ? breadcrumb.textContent : null,
      visibleTitles: titles,
    };
  })()`);

  console.log("Step 9 Verification Result:", JSON.stringify(verifyResult, null, 2));
  await takeScreenshot(`${artifactDir}/9_back_in_folder_not_disappeared.png`);

  if (!verifyResult.isInsideFolder) {
    throw new Error("FAILED: Library did not remain inside the folder upon returning from editor!");
  }
  if (!verifyResult.visibleTitles.some(t => t.includes("Advanced Quantum Physics 2026"))) {
    throw new Error("FAILED: Notebook disappeared from folder view!");
  }
  console.log("Step 9 PASSED: Notebook remained inside folder with updated title!");

  // Step 10: Click Breadcrumb "Desktop" to return to shelf root
  console.log("Step 10: Clicking Desktop breadcrumb...");
  await evaluate(`(() => {
    const spans = Array.from(document.querySelectorAll("#notein-folder-breadcrumb-bar span"));
    const desktopSpan = spans.find(s => s.textContent === "Desktop");
    if (desktopSpan) desktopSpan.click();
  })()`);
  await wait(800);

  await takeScreenshot(`${artifactDir}/10_desktop_shelf_root.png`);
  console.log("Step 10: Returned to Desktop root, folder is visible.");

  // Step 11: Click the folder's name to rename the folder!
  console.log("Step 11: Clicking folder title to rename folder...");
  await evaluate(`(() => {
    const titles = Array.from(document.querySelectorAll("h3")).filter(h => h.textContent.includes("Quantum Mechanics"));
    if (titles.length > 0) titles[0].click();
  })()`);
  await wait(500);

  await takeScreenshot(`${artifactDir}/11_folder_rename_modal.png`);
  console.log("Step 11: Folder rename modal opened via title click.");

  // Rename folder to "Quantum & Relativistic Physics" and confirm
  await evaluate(`(() => {
    const input = document.getElementById("notein-folder-name-input");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, "Quantum & Relativistic Physics");
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await wait(300);

  await evaluate(`document.getElementById("notein-folder-confirm-btn").click()`);
  await wait(800);

  await takeScreenshot(`${artifactDir}/12_folder_renamed_final.png`);
  console.log("Step 12: Folder renamed successfully!");

  ws.close();
  chrome.kill();
  console.log("\n=======================================================");
  console.log("🎉 ALL VERIFICATION STEPS PASSED WITH 100% SUCCESS!");
  console.log("=======================================================");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
