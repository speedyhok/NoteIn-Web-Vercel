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
    "--user-data-dir=/tmp/chrome-move-profile-" + Date.now(),
    "--remote-debugging-port=9224",
    "http://localhost:5174/",
  ]);

  let targets = null;
  for (let i = 0; i < 30; i++) {
    await wait(300);
    try {
      const res = await fetch("http://127.0.0.1:9224/json");
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

  await wait(1800);

  // 1. Click 3-dot menu on first notebook card
  console.log("Opening 3-dot menu on first notebook card...");
  await evaluate(`(() => {
    const moreBtns = Array.from(document.querySelectorAll('button')).filter(b => b.getAttribute('aria-label') === 'Notebook options');
    if (moreBtns.length > 0) moreBtns[0].click();
  })()`);
  await wait(300);

  // 2. Click Move to Folder option in menu
  console.log("Clicking Move to Folder menu option...");
  await evaluate(`(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const moveBtn = btns.find(b => b.textContent && b.textContent.includes("Move to Folder"));
    if (moveBtn) moveBtn.click();
  })()`);
  await wait(500);

  // Screenshot of Move to Folder Modal
  await takeScreenshot("/home/ubuntu/.gemini/antigravity-ide/brain/2721baf0-5de5-4c9f-ae3f-51019fcf887f/move_to_folder_modal.png");
  console.log("Saved move_to_folder_modal.png");

  // 3. Select Physics Research and click Move Here
  console.log("Selecting Physics Research destination and confirming move...");
  await evaluate(`(() => {
    const folderRows = Array.from(document.querySelectorAll("div"));
    const row = folderRows.find(d => d.textContent && d.textContent.includes("Physics Research"));
    if (row) row.click();
  })()`);
  await wait(300);

  await evaluate(`(() => {
    const moveHereBtn = document.getElementById("move-folder-confirm-btn");
    if (moveHereBtn) moveHereBtn.click();
  })()`);
  await wait(800);

  // 4. Click Physics Research folder to enter it and see the moved notebook
  console.log("Entering Physics Research folder to view moved notebook...");
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

  await takeScreenshot("/home/ubuntu/.gemini/antigravity-ide/brain/2721baf0-5de5-4c9f-ae3f-51019fcf887f/folder_with_moved_notebook.png");
  console.log("Saved folder_with_moved_notebook.png");

  ws.close();
  chrome.kill();
  process.exit(0);
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
