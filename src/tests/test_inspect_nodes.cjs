const cp = require("child_process");

async function wait(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function run() {
  const chrome = cp.spawn("/usr/bin/google-chrome", [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--window-size=1440,920",
    "--user-data-dir=/tmp/chrome-nodes-" + Date.now(),
    "--remote-debugging-port=9264",
    "http://localhost:5174/",
  ]);
  await wait(2000);
  const res = await fetch("http://127.0.0.1:9264/json");
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

  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: 700, y: 350, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 700, y: 350, button: "left", clickCount: 1 });
  await wait(500);

  for (const char of "Hello") {
    await send("Input.dispatchKeyEvent", { type: "keyDown", text: char, unmodifiedText: char, key: char });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: char });
    await wait(30);
  }
  await wait(500);

  const nodeInfo = await evaluate(`(() => {
    const ed = document.querySelector("[contenteditable=true]");
    return {
      innerHTML: ed ? ed.innerHTML : null,
      children: ed ? Array.from(ed.childNodes).map(n => ({ nodeType: n.nodeType, text: n.textContent, name: n.nodeName })) : null
    };
  })()`);
  console.log("Editor DOM nodes:", nodeInfo);

  ws.close();
  chrome.kill();
}

run().catch(console.error);
