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
    "--user-data-dir=/tmp/chrome-fit-demo-" + Date.now(),
    "--remote-debugging-port=9261",
    "http://localhost:5174/",
  ]);
  await wait(2000);
  const res = await fetch("http://127.0.0.1:9261/json");
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

  // Inject a prototype container with fit-content into document.body to test behavior
  const sizes = await evaluate(`(() => {
    const parent = document.createElement("div");
    parent.style.position = "absolute";
    parent.style.left = "100px";
    parent.style.top = "100px";
    parent.style.width = "fit-content";
    parent.style.minWidth = "60px";
    parent.style.maxWidth = "600px";
    parent.style.padding = "4px 8px";
    parent.style.border = "1.5px dashed #3b82f6";
    parent.style.borderRadius = "4px";
    parent.style.fontFamily = "Inter, sans-serif";
    parent.style.fontSize = "16px";

    const editor = document.createElement("div");
    editor.contentEditable = "true";
    editor.style.outline = "none";
    editor.style.border = "none";
    editor.style.whiteSpace = "pre-wrap";
    editor.style.wordBreak = "break-word";
    editor.innerHTML = "Hi";

    parent.appendChild(editor);
    document.body.appendChild(parent);

    const r1 = parent.getBoundingClientRect();
    const w1 = r1.width;

    editor.innerHTML = "NoteIn Web is great";
    const r2 = parent.getBoundingClientRect();
    const w2 = r2.width;

    parent.remove();

    return {
      widthForHi: w1,
      widthForSentence: w2
    };
  })()`);
  console.log("Measured sizes with fit-content:", sizes);

  ws.close();
  chrome.kill();
}

run().catch(console.error);
