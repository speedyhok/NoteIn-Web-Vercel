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
    "--user-data-dir=/tmp/chrome-snug-" + Date.now(),
    "--remote-debugging-port=9262",
    "http://localhost:5174/",
  ]);
  await wait(2000);
  const res = await fetch("http://127.0.0.1:9262/json");
  const targets = await res.json();
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 1;
  function send(method, params = {}) {
    return new Promise((resolve) => {
      const curId = id++;
      const listener = (event) => {
        const d = JSON.parse(event.data);
        if (d.id === curId) {
          ws.removeEventListener("message", listener);
          resolve(d.result);
        }
      };
      ws.addEventListener("message", listener);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });
  }
  await send("Page.enable");
  await send("Runtime.enable");

  async function evaluate(exp) {
    const r = await send("Runtime.evaluate", {
      expression: exp,
      returnByValue: true,
      awaitPromise: true,
    });
    return r.result.value;
  }

  await wait(1500);
  await evaluate(`(() => {
    const card = document.querySelector(".notebook-page-sheet") || document.querySelector(".notebook-card");
    if (card) card.click();
  })()`);
  await wait(1500);

  await evaluate(`(() => {
    const textBtn = document.querySelector('button[title*="Text" i]');
    if (textBtn) textBtn.click();
  })()`);
  await wait(500);

  // Click on paper to create text box
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: 700, y: 350, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 700, y: 350, button: "left", clickCount: 1 });
  await wait(500);

  const initialDotted = await evaluate(`(() => {
    const box = document.querySelector("[style*='dashed']");
    const r = box ? box.getBoundingClientRect() : null;
    return r ? { width: Math.round(r.width), height: Math.round(r.height) } : null;
  })()`);
  console.log("Initial empty dotted box:", initialDotted);

  for (const char of "Hello") {
    await send("Input.dispatchKeyEvent", { type: "keyDown", text: char, unmodifiedText: char, key: char });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: char });
    await wait(30);
  }
  await wait(500);

  const afterHello = await evaluate(`(() => {
    const box = document.querySelector("[style*='dashed']");
    const r = box ? box.getBoundingClientRect() : null;
    return r ? { width: Math.round(r.width), height: Math.round(r.height) } : null;
  })()`);
  console.log("Dotted box for 'Hello':", afterHello);

  ws.close();
  chrome.kill();
}

run().catch(console.error);
