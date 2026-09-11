// Local-only UI verification fallback when the in-app Browser connection is unavailable.
// Uses an isolated Chrome profile, no existing browser state or credentials.
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import WebSocket from 'ws';

const profile = await mkdtemp(join(tmpdir(), 'kompra-analytics-ui-'));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9228', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket;
try {
  let pages;
  for (let i = 0; i < 40; i++) {
    try { pages = await (await fetch('http://127.0.0.1:9228/json')).json(); if (pages.length) break; } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => socket.once('open', resolve));
  let id = 0;
  const requests = new Map();
  socket.on('message', raw => {
    const message = JSON.parse(String(raw));
    if (message.id) { const request = requests.get(message.id); requests.delete(message.id); if (message.error) request?.reject(message.error); else request?.resolve(message.result); }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; requests.set(key, { resolve, reject }); socket.send(JSON.stringify({ id: key, method, params })); });
  await send('Page.enable');
  await send('Runtime.enable');
  console.log(JSON.stringify({ ready: true, profile }));
  for await (const line of createInterface({ input: process.stdin })) {
    try {
      const command = JSON.parse(line);
      if (command.exit) break;
      if (command.screenshot) {
        const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        const path = join(profile, command.screenshot + '.png');
        await writeFile(path, Buffer.from(result.data, 'base64'));
        console.log(JSON.stringify({ screenshot: path }));
      } else console.log(JSON.stringify(await send(command.method, command.params)));
    } catch (error) { console.log(JSON.stringify({ error: String(error) })); }
  }
} finally { socket?.close(); chrome.kill(); }
