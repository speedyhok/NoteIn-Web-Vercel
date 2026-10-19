const cp = require("child_process");
const fs = require("fs");

async function wait(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function run() {
  const chrome = cp.spawn("/usr/bin/google-chrome", [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--window-size=1440,920",
    "--user-data-dir=/tmp/chrome-test-input-" + Date.now(),
    "--remote-debugging-port=9226",
    "http://localhost:5174/",
  ]);

  let targets = null;
  for (let i = 0; i < 30; i++) {
    await wait(300);
    try {
      const res = await fetch("http://127.0.0.1:9226/json");
      targets = await res.json();
      if (targets && targets.length > 0) break;
    } catch {}
  }

  const pageTarget = targets.find((t) => t.type === "page");
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

  await wait(2000);

  // 1. Click New Folder
  await evaluate(`document.getElementById("notein-new-folder-header-btn").click()`);
  await wait(400);

  // 2. Set input using native setter
  const modalInfo = await evaluate(`(() => {
    const input = document.querySelector('input[placeholder="Folder Name"]');
    if (!input) return { error: "no input" };
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, "Quantum Mechanics");
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    const btns = Array.from(document.querySelectorAll('button'));
    const confirmBtn = btns.find(b => b.textContent && b.textContent.includes("Confirm"));
    return {
      inputValue: input.value,
      confirmDisabled: confirmBtn ? confirmBtn.disabled : null
    };
  })()`);
  console.log("Modal Info after native setter:", modalInfo);

  // 3. Click confirm
  await evaluate(`(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const confirmBtn = btns.find(b => b.textContent && b.textContent.includes("Confirm"));
    if (confirmBtn) confirmBtn.click();
  })()`);
  await wait(800);

  const folderCount = await evaluate(`(() => {
    return Array.from(document.querySelectorAll("h3")).map(h => h.textContent);
  })()`);
  console.log("Titles on shelf after create folder:", folderCount);

  ws.close();
  chrome.kill();
}
run();
