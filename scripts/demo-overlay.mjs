// On-screen guides for the recorded demo: a bold caption bar, a ring with an arrow and label on the
// part of the screen being described, and full-screen title cards. Nothing here touches the app's data.

const LIME = "#d4f59a";
const INK = "#0b0b0b";

/** Adds the cursor, caption bar and overlay layer. A full page load removes them, so call it after each navigation. */
export async function dress(page) {
  await page.evaluate(({ LIME, INK }) => {
    if (document.getElementById("demo-caption")) return;
    const style = document.createElement("style");
    style.textContent = `
      @keyframes demo-pulse { 0%,100% { box-shadow: 0 0 0 4px rgba(212,245,154,.55), 0 0 0 0 rgba(212,245,154,.5) } 50% { box-shadow: 0 0 0 4px rgba(212,245,154,.9), 0 0 0 14px rgba(212,245,154,0) } }
      @keyframes demo-in { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
      @keyframes demo-nudge { 0%,100% { transform: translate(0,0) } 50% { transform: translate(var(--nx), var(--ny)) } }
      .demo-ring { position: fixed; border: 3px solid ${LIME}; border-radius: 12px; animation: demo-pulse 1.4s ease-in-out infinite, demo-in .25s ease-out both }
      .demo-label { position: fixed; padding: 10px 16px; border-radius: 10px; background: ${INK}; color: #fff; font-family: inherit; font-weight: 800; font-size: 20px; line-height: 1.2; letter-spacing: -.01em; box-shadow: 0 10px 30px rgba(0,0,0,.35); white-space: nowrap; animation: demo-in .3s ease-out both }
      .demo-label b { color: ${LIME}; font-weight: 800 }
      .demo-arrow { position: fixed; overflow: visible; animation: demo-in .3s ease-out both, demo-nudge 1.1s ease-in-out .3s infinite }
    `;
    document.head.appendChild(style);

    const cursor = document.createElement("div");
    cursor.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M5 3L19 12L12 13L9 20L5 3Z" fill="white" stroke="black" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    cursor.style.cssText = "position:fixed;z-index:1000001;pointer-events:none;left:0;top:0;transition:left .1s,top .1s";
    document.body.appendChild(cursor);
    document.addEventListener("mousemove", (e) => {
      cursor.style.left = `${e.clientX}px`;
      cursor.style.top = `${e.clientY}px`;
    });

    const layer = document.createElement("div");
    layer.id = "demo-layer";
    layer.style.cssText = "position:fixed;inset:0;z-index:999999;pointer-events:none;font-family:inherit";
    document.body.appendChild(layer);

    const bar = document.createElement("div");
    bar.id = "demo-caption";
    bar.style.cssText = "position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:1000000;width:max-content;max-width:1180px;display:flex;align-items:center;gap:14px;padding:14px 22px;border-radius:14px;background:rgba(11,11,11,.94);color:#fff;font-family:inherit;font-weight:700;font-size:24px;line-height:1.25;letter-spacing:-.01em;box-shadow:0 12px 40px rgba(0,0,0,.35);pointer-events:none";
    bar.innerHTML = `<span id="demo-step" style="flex:none;padding:4px 10px;border-radius:8px;background:${LIME};color:${INK};font-weight:800;font-size:16px"></span><span id="demo-text"></span>`;
    document.body.appendChild(bar);
  }, { LIME, INK });
}

/** Sets the caption. `step` is a short tag such as "1 / 4", shown in a lime pill. */
export async function caption(page, text, step = "") {
  await page.evaluate(([t, s]) => {
    document.getElementById("demo-text").textContent = t;
    const pill = document.getElementById("demo-step");
    pill.textContent = s;
    pill.style.display = s ? "inline-block" : "none";
  }, [text, step]);
}

export async function clearCallout(page) {
  await page.evaluate(() => {
    const layer = document.getElementById("demo-layer");
    if (layer) layer.innerHTML = "";
  });
}

/**
 * Rings the element and points an arrow at it from a bold label. The label sits on whichever side
 * has the most room, so it never covers the thing it points at.
 */
export async function callout(page, locator, html) {
  const box = await locator.boundingBox();
  if (!box) return;
  await page.evaluate(({ box, html, LIME }) => {
    const layer = document.getElementById("demo-layer");
    layer.innerHTML = "";
    const pad = 6;
    const ring = document.createElement("div");
    ring.className = "demo-ring";
    Object.assign(ring.style, { left: `${box.x - pad}px`, top: `${box.y - pad}px`, width: `${box.width + pad * 2}px`, height: `${box.height + pad * 2}px` });
    layer.appendChild(ring);

    const label = document.createElement("div");
    label.className = "demo-label";
    label.innerHTML = html;
    layer.appendChild(label);
    const lw = label.offsetWidth;
    const lh = label.offsetHeight;
    const vw = innerWidth;
    const vh = innerHeight - 100; // keeps clear of the caption bar
    const gap = 70;
    const room = { left: box.x - pad, right: vw - (box.x + box.width + pad), above: box.y - pad, below: vh - (box.y + box.height + pad) };
    const side = room.left > lw + gap + 20 ? "left" : room.right > lw + gap + 20 ? "right" : room.above > lh + gap ? "above" : "below";
    const cy = Math.min(Math.max(box.y + box.height / 2 - lh / 2, 12), vh - lh);
    const cx = Math.min(Math.max(box.x + box.width / 2 - lw / 2, 12), vw - lw - 12);
    const pos = {
      left: [box.x - pad - gap - lw, cy],
      right: [box.x + box.width + pad + gap, cy],
      above: [cx, box.y - pad - gap - lh],
      below: [cx, box.y + box.height + pad + gap],
    }[side];
    label.style.left = `${pos[0]}px`;
    label.style.top = `${pos[1]}px`;

    // An arrow from the label's edge to the ring's edge, with a solid head.
    const from = {
      left: [pos[0] + lw + 6, pos[1] + lh / 2],
      right: [pos[0] - 6, pos[1] + lh / 2],
      above: [pos[0] + lw / 2, pos[1] + lh + 6],
      below: [pos[0] + lw / 2, pos[1] - 6],
    }[side];
    const to = {
      left: [box.x - pad - 8, box.y + box.height / 2],
      right: [box.x + box.width + pad + 8, box.y + box.height / 2],
      above: [box.x + box.width / 2, box.y - pad - 8],
      below: [box.x + box.width / 2, box.y + box.height + pad + 8],
    }[side];
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const len = Math.hypot(dx, dy) || 1;
    const angle = Math.atan2(dy, dx);
    const head = (a) => `${to[0] - 18 * Math.cos(angle + a)},${to[1] - 18 * Math.sin(angle + a)}`;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "demo-arrow");
    svg.setAttribute("width", String(vw));
    svg.setAttribute("height", String(innerHeight));
    svg.style.left = "0";
    svg.style.top = "0";
    svg.style.setProperty("--nx", `${(dx / len) * 6}px`);
    svg.style.setProperty("--ny", `${(dy / len) * 6}px`);
    svg.innerHTML = `
      <line x1="${from[0]}" y1="${from[1]}" x2="${to[0] - 10 * Math.cos(angle)}" y2="${to[1] - 10 * Math.sin(angle)}" stroke="${LIME}" stroke-width="5" stroke-linecap="round"/>
      <polygon points="${to[0]},${to[1]} ${head(0.5)} ${head(-0.5)}" fill="${LIME}"/>`;
    layer.appendChild(svg);
  }, { box, html, LIME });
}

/** A full-screen card with a big bold title, shown for `ms` and then faded out. */
export async function titleCard(page, title, subtitle, ms) {
  await page.evaluate(({ title, subtitle, LIME, INK }) => {
    const card = document.createElement("div");
    card.id = "demo-card";
    card.style.cssText = `position:fixed;inset:0;z-index:1000002;display:grid;place-content:center;gap:18px;text-align:center;background:${INK};color:#fff;font-family:inherit;transition:opacity .45s ease`;
    card.innerHTML = `
      <div style="justify-self:center;padding:6px 14px;border-radius:999px;background:${LIME};color:${INK};font-weight:800;font-size:16px;letter-spacing:.06em">PLUMBLINE</div>
      <div style="font-weight:800;font-size:58px;line-height:1.05;letter-spacing:-.03em;max-width:980px">${title}</div>
      <div style="font-weight:600;font-size:24px;line-height:1.35;color:rgba(255,255,255,.72);max-width:860px">${subtitle}</div>`;
    document.body.appendChild(card);
  }, { title, subtitle, LIME, INK });
  await page.waitForTimeout(ms);
  await page.evaluate(() => {
    const card = document.getElementById("demo-card");
    if (!card) return;
    card.style.opacity = "0";
    setTimeout(() => card.remove(), 500);
  });
  await page.waitForTimeout(500);
}
