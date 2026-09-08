// ---------------------------------------------------------------------
// Deposit Box Vault — client-side decrypt only.
// The vault file (data/vault.enc.json) holds ciphertext produced by
// encrypt-tool.html. This script never has access to plaintext until
// the correct passphrase is entered, and decryption happens entirely
// in the browser. No network requests are made with the passphrase
// or the decrypted contents.
// ---------------------------------------------------------------------

const PBKDF2_ITERATIONS = 250000;

const dialWrap = document.getElementById("dialWrap");
const lockScreen = document.getElementById("lockScreen");
const vaultScreen = document.getElementById("vaultScreen");
const passphraseInput = document.getElementById("passphrase");
const unlockBtn = document.getElementById("unlockBtn");
const lockBtn = document.getElementById("lockBtn");
const errorMsg = document.getElementById("errorMsg");
const boxList = document.getElementById("boxList");
const entryCount = document.getElementById("entryCount");

drawTicks();

function drawTicks() {
  const svgNS = "http://www.w3.org/2000/svg";
  const ticksGroup = document.getElementById("ticks");
  const cx = 110, cy = 110, rOuter = 96, rInner = 88;
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    const x1 = cx + rOuter * Math.cos(angle);
    const y1 = cy + rOuter * Math.sin(angle);
    const x2 = cx + rInner * Math.cos(angle);
    const y2 = cy + rInner * Math.sin(angle);
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", x1.toFixed(1));
    line.setAttribute("y1", y1.toFixed(1));
    line.setAttribute("x2", x2.toFixed(1));
    line.setAttribute("y2", y2.toFixed(1));
    ticksGroup.appendChild(line);
  }
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function deriveKey(passphrase, saltBytes) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
}

async function decryptVault(passphrase, vaultFile) {
  const salt = base64ToBytes(vaultFile.salt);
  const iv = base64ToBytes(vaultFile.iv);
  const ciphertext = base64ToBytes(vaultFile.ciphertext);

  const key = await deriveKey(passphrase, salt);
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  const json = new TextDecoder().decode(plainBuf);
  return JSON.parse(json);
}

function renderVault(entries) {
  boxList.innerHTML = "";
  entryCount.textContent = `${entries.length} box${entries.length === 1 ? "" : "es"}`;

  entries.forEach((entry, idx) => {
    const row = document.createElement("div");
    row.className = "box-row";

    const num = String(idx + 1).padStart(3, "0");

    row.innerHTML = `
      <div class="box-row-top">
        <span class="box-number">${num}</span>
        <span class="box-label">${escapeHtml(entry.label)}</span>
        <div class="box-actions">
          <button class="icon-btn reveal-btn">Reveal</button>
          <button class="icon-btn copy-btn">Copy</button>
        </div>
      </div>
      <div class="box-value-wrap">
        <div class="box-value">${escapeHtml(entry.value)}</div>
      </div>
    `;

    const revealBtn = row.querySelector(".reveal-btn");
    const copyBtn = row.querySelector(".copy-btn");
    const valueWrap = row.querySelector(".box-value-wrap");

    revealBtn.addEventListener("click", () => {
      const revealed = valueWrap.classList.toggle("revealed");
      revealBtn.textContent = revealed ? "Hide" : "Reveal";
    });

    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(entry.value);
        copyBtn.textContent = "Copied";
        setTimeout(() => (copyBtn.textContent = "Copy"), 1200);
      } catch {
        copyBtn.textContent = "Select manually";
        setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
      }
    });

    boxList.appendChild(row);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function attemptUnlock() {
  const passphrase = passphraseInput.value;
  errorMsg.textContent = "";

  if (!passphrase) {
    errorMsg.textContent = "Enter a passphrase first.";
    return;
  }

  unlockBtn.disabled = true;
  dialWrap.classList.add("spinning");

  try {
    const res = await fetch("data/vault.enc.json", { cache: "no-store" });
    if (!res.ok) throw new Error("vault file not found");
    const vaultFile = await res.json();

    const entries = await decryptVault(passphrase, vaultFile);

    setTimeout(() => {
      renderVault(entries);
      lockScreen.style.display = "none";
      vaultScreen.classList.add("active");
      passphraseInput.value = "";
      dialWrap.classList.remove("spinning");
      unlockBtn.disabled = false;
    }, 500);
  } catch (err) {
    dialWrap.classList.remove("spinning");
    unlockBtn.disabled = false;
    errorMsg.textContent = "Wrong passphrase, or the vault file is missing.";
  }
}

unlockBtn.addEventListener("click", attemptUnlock);
passphraseInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") attemptUnlock();
});

lockBtn.addEventListener("click", () => {
  vaultScreen.classList.remove("active");
  lockScreen.style.display = "";
  boxList.innerHTML = "";
});
