const cp = require("child_process");
const fs = require("fs");

async function wait(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function runTest() {
  const chrome = cp.spawn("/usr/bin/google-chrome", [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--window-size=1400,900",
    "--user-data-dir=/tmp/chrome-full-flow-" + Date.now(),
    "--remote-debugging-port=9225",
    "http://localhost:5174/",
  ]);

  let targets = null;
  for (let i = 0; i < 30; i++) {
    await wait(300);
    try {
      const res = await fetch("http://127.0.0.1:9225/json");
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
  await send("Page.navigate", { url: "http://localhost:5174/" });

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

  console.log("Waiting for library UI to mount...");
  for (let i = 0; i < 30; i++) {
    const exists = await evaluate(`Boolean(document.getElementById("notein-new-folder-header-btn"))`);
    if (exists) break;
    await wait(300);
  }

  // 1. Create Folder "Study Notes" with Mint color
  console.log("Creating folder Study Notes...");
  await evaluate(`(() => {
    document.getElementById("notein-new-folder-header-btn").click();
  })()`);
  await wait(400);

  await evaluate(`(() => {
    const input = document.getElementById("notein-folder-name-input");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, "Study Notes");
    input.dispatchEvent(new Event("input", { bubbles: true }));

    const swatches = Array.from(document.querySelectorAll("button[title]"));
    const mint = swatches.find(b => b.getAttribute("title") === "Mint");
    if (mint) mint.click();
  })()`);
  await wait(300);

  await evaluate(`(() => {
    document.getElementById("notein-folder-confirm-btn").click();
  })()`);
  await wait(800);

  // 2. Open 3-dot menu on first notebook card and click Move to Folder
  console.log("Moving notebook to Study Notes folder...");
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

  await takeScreenshot("/home/ubuntu/.gemini/antigravity-ide/brain/2721baf0-5de5-4c9f-ae3f-51019fcf887f/move_to_folder_dialog_with_folders.png");

  // Select "Study Notes" and click "Move Here"
  await evaluate(`(() => {
    const row = document.querySelector(".move-dest-folder-row");
    if (row) row.click();
  })()`);
  await wait(300);

  await evaluate(`(() => {
    document.getElementById("move-folder-confirm-btn").click();
  })()`);
  await wait(800);

  // Take screenshot of shelf: now Study Notes shows "1 item"!
  await takeScreenshot("/home/ubuntu/.gemini/antigravity-ide/brain/2721baf0-5de5-4c9f-ae3f-51019fcf887f/shelf_with_study_notes_1_item.png");

  // 3. Click into Study Notes folder
  console.log("Entering Study Notes folder...");
  await evaluate(`(() => {
    const cards = Array.from(document.querySelectorAll("h3"));
    const folderTitle = cards.find(h => h.textContent && h.textContent.includes("Study Notes"));
    if (folderTitle) {
      let el = folderTitle;
      while (el && el.parentElement && !el.getAttribute("style")?.includes("cursor: pointer")) {
        el = el.parentElement;
      }
      if (el) el.click();
    }
  })()`);
  await wait(600);

  // Screenshot inside folder showing the moved notebook!
  await takeScreenshot("/home/ubuntu/.gemini/antigravity-ide/brain/2721baf0-5de5-4c9f-ae3f-51019fcf887f/inside_study_notes_folder.png");

  ws.close();
  chrome.kill();
  console.log("Full flow test passed!");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("Full flow test failed:", err);
  process.exit(1);
});
