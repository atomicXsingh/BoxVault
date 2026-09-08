# Deposit Box Vault

A demo pattern for a personal, password-gated vault site that's actually safe to publish on GitHub Pages — because the repo only ever holds **ciphertext**, never plaintext secrets.

**[Try the live idea locally →](#run-it-locally)** — demo passphrase: `brass-ledger-forty-two`

## What this is (and isn't)

This is a learning/demo project showing the *right* pattern for "I want a public repo that displays private data": encrypt client-side before anything touches git, decrypt client-side in the browser.

It is **not** a replacement for a real secrets manager. For credentials you actually use day to day (API keys you rotate into CI, database passwords, etc.), use a proper tool — 1Password, Bitwarden, HashiCorp Vault, or your cloud provider's secrets manager. Those handle rotation, access logging, sharing, and revocation, which this doesn't.

A static, offline-decryptable vault like this is reasonable for things like: a personal archive of low-rotation secrets, recovery codes, or private notes you want available from any browser without running your own server — as long as you understand the tradeoffs below.

## How it works

- `encrypt-tool.html` — open this **locally**, paste in your secrets and a passphrase, and it encrypts everything with AES-256-GCM (key derived from your passphrase via PBKDF2, 250,000 rounds) entirely inside your browser tab. Nothing is sent anywhere.
- It outputs `vault.enc.json` — this is the **only** file that should ever contain your data, and it's ciphertext, safe to commit.
- `index.html` / `script.js` — the public-facing site. It fetches `vault.enc.json`, asks for your passphrase, and decrypts in-browser. If the passphrase is wrong, GCM's built-in authentication tag makes decryption fail cleanly (no partial/garbled output).

## Security model — read this before using it for anything real

- **The ciphertext is public.** Anyone can download `vault.enc.json` from your repo or the deployed site and attempt to brute-force your passphrase offline, with no rate limiting, for as long as they want. Your passphrase is the *entire* security boundary.
- **Use a long, high-entropy passphrase** — a random 5-6 word phrase (e.g. from a diceware list), not a memorable sentence or anything reused elsewhere. PBKDF2 at 250k rounds slows down brute-forcing but doesn't make a weak passphrase safe.
- **Never commit anything other than `vault.enc.json`.** Don't paste plaintext into a commit, an issue, or a GitHub Pages build log.
- **Git history is permanent.** If you ever accidentally commit plaintext, rotate that secret immediately — assume it's compromised even after deleting it, since it likely remains in history until you rewrite it.
- **This protects confidentiality, not availability or integrity of your access.** If you lose the passphrase, there is no recovery — there's no backdoor, which is the point, but it means treat the passphrase itself like the master key it is.

## Run it locally

```bash
git clone <your-repo-url>
cd secure-vault-demo
python3 -m http.server 8000
# open http://localhost:8000
```

Try the demo passphrase `brass-ledger-forty-two` against the included `data/vault.enc.json` to see it work, then replace it with your own:

1. Open `encrypt-tool.html` directly in your browser (double-click the file, or serve it locally — just don't do this step on a hosted/public URL).
2. Enter a strong passphrase and your entries, one per line, as `label = value`.
3. Click **Encrypt**, then **Download vault.enc.json**.
4. Replace `data/vault.enc.json` with the downloaded file.
5. Commit and push. Only ciphertext ever hits git.

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. Repo **Settings → Pages → Source**: deploy from the `main` branch, root folder.
3. Your site will be live at `https://<username>.github.io/<repo>/`.

Remember: GitHub Pages is public by default (private-repo Pages requires GitHub Enterprise/paid plans with access controls) — that's expected here, since confidentiality comes from encryption, not from hiding the URL.

## File structure

```
├── index.html          # public vault UI (lock screen + decrypted view)
├── style.css
├── script.js            # decryption logic (WebCrypto AES-GCM + PBKDF2)
├── encrypt-tool.html    # run locally to produce vault.enc.json — never deploy with real plaintext in it
└── data/
    └── vault.enc.json   # ciphertext only — safe to commit
```
