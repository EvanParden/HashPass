# HashPass

**HashPass** is a simple, local password management tool that uses your browser's Web Crypto API to encrypt (or store in plain text if you prefer) your credentials. Everything runs locally, so no data ever leaves your machine.

## How to Use

1. **Load or Create Storage**
   - Select an existing JSON file from your computer (if you have one) via the **Load JSON** button.
   - Or click **Create New Storage** to start fresh.

2. **Set Optional Master Password**
   - If you set a master password, HashPass uses AES-GCM encryption (key derived via PBKDF2) to protect your data.
   - If left blank, your data is stored in plaintext.

3. **Encryption Algorithm & Security Level**
   - You can choose the “algorithm” (like AES-GCM, AES-CBC, etc.) and a key size (256-bit, 192-bit, etc.).
   - Currently, the actual cipher used is **AES-GCM** under the hood; we store your selected values in metadata for forward-compatibility.

4. **Add Entries**
   - Click **+ Add Entry** and fill out the website, username, password, notes.
   - Click **Save Entry** to add it to the list.

5. **Reveal Passwords**
   - In the list, click on the masked password (“••••••••”) to toggle visibility.

6. **Save & Download**
   - When you’re done, click **Save & Download** to export a JSON file containing your credentials (encrypted if you used a master password).

## How It Works

- **Local-Only**: All encryption/decryption happens in your browser via the Web Crypto API.
- **AES-GCM**: By default, we use AES-GCM with a 256-bit key. A password (if provided) is processed by PBKDF2 with 100k iterations.
- **Metadata**: We store chosen algorithm and security level in JSON for reference/backward compatibility.

## Why It’s Secure

- If you supply a master password, your data is encrypted using strong cryptographic primitives (AES-GCM).
- No servers are involved; your data never leaves your local environment.
- If you choose no password, your data isn’t encrypted (plain JSON), which is simpler but **not** secure.

## Development & Build

1. **Install Dependencies**
   ```bash
   npm install
   ```

1. **Build**
   ```bash
   npm run build
   ```

   - This compiles your TypeScript (app.ts) and Tailwind CSS (style.css) into a single dist/index.html (via inline.js).
3. **Open**
   - Open dist/index.html in your browser. No server needed.


---

**That’s it!** After running `npm run build`, you’ll get one **self-contained** `dist/index.html` (with inlined JS/CSS) that can be copied anywhere.
