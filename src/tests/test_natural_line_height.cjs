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
    "--user-data-dir=/tmp/chrome-lh-" + Date.now(),
    "--remote-debugging-port=9265",
    "http://localhost:5174/",
  ]);
  await wait(2000);
  const res = await fetch("http://127.0.0.1:9265/json");
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

  const resVal = await evaluate(`(() => {
    const d = document.createElement("div");
    d.contentEditable = "true";
    d.style.fontFamily = "Inter, sans-serif";
    d.style.fontSize = "16px";
    d.style.lineHeight = "1.35";
    d.style.padding = "0";
    d.style.margin = "0";
    d.innerHTML = "Hello";
    document.body.appendChild(d);

    const range = document.createRange();
    range.selectNodeContents(d);
    const r = range.getBoundingClientRect();
    const dr = d.getBoundingClientRect();

    d.remove();
    return { rangeHeight: r.height, divHeight: dr.height };
  })()`);
  console.log("Natural text line height:", resVal);

  ws.close();
  chrome.kill();
}

run().catch(console.error);
