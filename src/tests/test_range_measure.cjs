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
    "--user-data-dir=/tmp/chrome-range-" + Date.now(),
    "--remote-debugging-port=9260",
    "http://localhost:5174/",
  ]);
  await wait(2000);
  const res = await fetch("http://127.0.0.1:9260/json");
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

  const measureTest = await evaluate(`(() => {
    const div = document.createElement("div");
    div.contentEditable = "true";
    div.style.fontFamily = "Inter, sans-serif";
    div.style.fontSize = "16px";
    div.style.lineHeight = "1.5";
    div.style.position = "absolute";
    div.style.left = "100px";
    div.style.top = "100px";
    div.style.width = "400px"; // Parent is wide
    div.innerHTML = "Hello";
    document.body.appendChild(div);

    // Range measure
    const range = document.createRange();
    range.selectNodeContents(div);
    const rangeRect = range.getBoundingClientRect();
    const divRect = div.getBoundingClientRect();

    div.remove();
    return {
      rangeWidth: rangeRect.width,
      rangeHeight: rangeRect.height,
      divWidth: divRect.width,
      divHeight: divRect.height
    };
  })()`);
  console.log("Measurement result:", measureTest);

  ws.close();
  chrome.kill();
}

run().catch(console.error);
