// src/app.ts

// ---------- Types ----------
interface PasswordEntry {
   website: string;
   username: string;
   password: string;
   note: string;
 }

 interface EncryptedStore {
   iv: string;    // base64-encoded IV
   salt: string;  // base64-encoded salt
   data: string;  // base64-encoded ciphertext
 }

 // ---------- DOM References ----------
 const masterPasswordInput = document.getElementById("masterPassword") as HTMLInputElement;
 const jsonFileInput = document.getElementById("jsonFileInput") as HTMLInputElement;
 const loadJsonBtn = document.getElementById("loadJsonBtn") as HTMLButtonElement;
 const createJsonBtn = document.getElementById("createJsonBtn") as HTMLButtonElement;
 const entriesTableBody = document.getElementById("entriesTableBody") as HTMLTableSectionElement;
 const addEntryForm = document.getElementById("addEntryForm") as HTMLFormElement;
 const websiteInput = document.getElementById("websiteInput") as HTMLInputElement;
 const usernameInput = document.getElementById("usernameInput") as HTMLInputElement;
 const passwordInput = document.getElementById("passwordInput") as HTMLInputElement;
 const noteInput = document.getElementById("noteInput") as HTMLTextAreaElement;
 const downloadJsonBtn = document.getElementById("downloadJsonBtn") as HTMLButtonElement;

 // Modal references
 const entryModal = document.getElementById("entryModal") as HTMLDivElement;
 const modalWebsite = document.getElementById("modalWebsite") as HTMLSpanElement;
 const modalUsername = document.getElementById("modalUsername") as HTMLSpanElement;
 const modalPassword = document.getElementById("modalPassword") as HTMLSpanElement;
 const modalNotes = document.getElementById("modalNotes") as HTMLParagraphElement;
 const closeModalBtn = document.getElementById("closeModalBtn") as HTMLButtonElement;
 const copyUsernameBtn = document.getElementById("copyUsernameBtn") as HTMLButtonElement;
 const copyPasswordBtn = document.getElementById("copyPasswordBtn") as HTMLButtonElement;

 // ---------- Global In-Memory Store ----------
 let entries: PasswordEntry[] = [];
 let currentSalt: Uint8Array | null = null;
 let currentIV: Uint8Array | null = null;

 // ---------- Utility: Base64 encode/decode ----------
 function base64ToArrayBuffer(base64: string): ArrayBuffer {
   const binaryString = window.atob(base64);
   const len = binaryString.length;
   const bytes = new Uint8Array(len);
   for (let i = 0; i < len; i++) {
     bytes[i] = binaryString.charCodeAt(i);
   }
   return bytes.buffer;
 }

 function arrayBufferToBase64(buffer: ArrayBuffer): string {
   const bytes = new Uint8Array(buffer);
   let binary = "";
   for (let i = 0; i < bytes.byteLength; i++) {
     binary += String.fromCharCode(bytes[i]);
   }
   return window.btoa(binary);
 }

 // ---------- Key Derivation & Crypto Helpers ----------
 async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
   const enc = new TextEncoder();
   const keyMaterial = await window.crypto.subtle.importKey(
     "raw",
     enc.encode(password),
     { name: "PBKDF2" },
     false,
     ["deriveKey"]
   );
   return window.crypto.subtle.deriveKey(
     {
       name: "PBKDF2",
       salt: salt,
       iterations: 100000,
       hash: "SHA-256",
     },
     keyMaterial,
     { name: "AES-GCM", length: 256 },
     false,
     ["encrypt", "decrypt"]
   );
 }

 async function encryptWithPassword(
   password: string,
   plainData: string
 ): Promise<EncryptedStore> {
   if (!currentSalt) {
     currentSalt = window.crypto.getRandomValues(new Uint8Array(16));
   }
   if (!currentIV) {
     currentIV = window.crypto.getRandomValues(new Uint8Array(12));
   }

   const key = await deriveKey(password, currentSalt);
   const enc = new TextEncoder();
   const encrypted = await window.crypto.subtle.encrypt(
     { name: "AES-GCM", iv: currentIV },
     key,
     enc.encode(plainData)
   );

   return {
     iv: arrayBufferToBase64(currentIV.buffer),
     salt: arrayBufferToBase64(currentSalt.buffer),
     data: arrayBufferToBase64(encrypted),
   };
 }

 async function decryptWithPassword(
   password: string,
   store: EncryptedStore
 ): Promise<string> {
   const iv = new Uint8Array(base64ToArrayBuffer(store.iv));
   const salt = new Uint8Array(base64ToArrayBuffer(store.salt));
   const ciphertext = base64ToArrayBuffer(store.data);

   const key = await deriveKey(password, salt);
   const decrypted = await window.crypto.subtle.decrypt(
     { name: "AES-GCM", iv },
     key,
     ciphertext
   );

   const dec = new TextDecoder();
   return dec.decode(decrypted);
 }

 // ---------- Encryption / Decryption of Entries ----------
 async function encryptEntries(
   password: string,
   entries: PasswordEntry[]
 ): Promise<string> {
   const data = JSON.stringify(entries);
   // If password is empty, store plain JSON (not secure)
   if (!password) {
     return JSON.stringify({
       iv: "",
       salt: "",
       data
     }, null, 2);
   }
   // Otherwise, do real encryption
   const store = await encryptWithPassword(password, data);
   return JSON.stringify(store, null, 2);
 }

 async function decryptEntries(password: string, fileText: string): Promise<PasswordEntry[]> {
   const parsed = JSON.parse(fileText) as EncryptedStore;

   // If there's no iv/salt, assume it was plain
   if (!parsed.iv && !parsed.salt) {
     // `parsed.data` is just the plain JSON string of entries
     return JSON.parse(parsed.data);
   } else {
     // Do real decryption
     const plainData = await decryptWithPassword(password, parsed);
     return JSON.parse(plainData);
   }
 }

 // ---------- UI Routines ----------
 function renderTable() {
   entriesTableBody.innerHTML = "";

   entries.forEach((entry, idx) => {
     const row = document.createElement("tr");
     row.className = "cursor-pointer hover:bg-gray-50";

     const websiteTD = document.createElement("td");
     websiteTD.className = "p-3";
     websiteTD.textContent = entry.website;

     const usernameTD = document.createElement("td");
     usernameTD.className = "p-3";
     usernameTD.textContent = entry.username;

     const passwordTD = document.createElement("td");
     passwordTD.className = "p-3";
     // We'll just show **** but not the actual password in the table
     passwordTD.textContent = "••••••••";

     // Clicking the row opens the modal
     row.addEventListener("click", () => {
       openEntryModal(entry);
     });

     row.appendChild(websiteTD);
     row.appendChild(usernameTD);
     row.appendChild(passwordTD);
     entriesTableBody.appendChild(row);
   });
 }

 function openEntryModal(entry: PasswordEntry) {
   modalWebsite.textContent = entry.website;
   modalUsername.textContent = entry.username;
   modalPassword.textContent = entry.password;
   modalNotes.textContent = entry.note;

   entryModal.classList.remove("hidden");
 }

 function closeEntryModal() {
   entryModal.classList.add("hidden");
 }

 // ---------- Copy Function ----------
 function copyTextToClipboard(text: string) {
   navigator.clipboard.writeText(text).then(
     () => {
       alert("Copied to clipboard");
     },
     (err) => {
       console.error("Failed to copy: ", err);
       alert("Failed to copy to clipboard.");
     }
   );
 }

 // ---------- Event Handlers ----------

 // 1. Load existing JSON
 loadJsonBtn.addEventListener("click", async () => {
   const file = jsonFileInput.files?.[0];
   const masterPass = masterPasswordInput.value; // may be empty
   if (!file) {
     alert("Please select a JSON file.");
     return;
   }

   try {
     const fileText = await file.text();
     const decrypted = await decryptEntries(masterPass, fileText);

     // If the file was actually encrypted, we can also parse out salt/iv
     // so that subsequent saves use the same salt/iv. But that's optional.
     // For simplicity, if it was plain, we won't set salt/iv.

     const parsed = JSON.parse(fileText);
     if (parsed.iv && parsed.salt) {
       currentSalt = new Uint8Array(base64ToArrayBuffer(parsed.salt));
       currentIV   = new Uint8Array(base64ToArrayBuffer(parsed.iv));
     } else {
       currentSalt = null;
       currentIV = null;
     }

     entries = decrypted;
     renderTable();
     alert("File loaded successfully!");
   } catch (err) {
     console.error(err);
     alert("Failed to load or decrypt. Check console for details.");
   }
 });

 // 2. Create new storage (empty)
 createJsonBtn.addEventListener("click", () => {
   // Clear in-memory store
   entries = [];
   // Reset salt/IV so a new encryption context can be generated on next save
   currentSalt = null;
   currentIV = null;

   renderTable();
   alert("New storage created (currently empty).");
 });

 // 3. Add new entry
 addEntryForm.addEventListener("submit", (e) => {
   e.preventDefault();
   const newEntry: PasswordEntry = {
     website: websiteInput.value.trim(),
     username: usernameInput.value.trim(),
     password: passwordInput.value.trim(),
     note: noteInput.value.trim(),
   };
   entries.push(newEntry);

   // Reset fields
   websiteInput.value = "";
   usernameInput.value = "";
   passwordInput.value = "";
   noteInput.value = "";

   renderTable();
 });

 // 4. Save and download current storage
 downloadJsonBtn.addEventListener("click", async () => {
   try {
     const masterPass = masterPasswordInput.value; // may be empty
     const encryptedContent = await encryptEntries(masterPass, entries);

     // Create a blob and download
     const blob = new Blob([encryptedContent], { type: "application/json" });
     const url = URL.createObjectURL(blob);
     const a = document.createElement("a");
     a.href = url;
     a.download = "passwords.json";
     a.click();
     URL.revokeObjectURL(url);
   } catch (err) {
     console.error(err);
     alert("Save failed. Check console for details.");
   }
 });

 // 5. Modal close button
 closeModalBtn.addEventListener("click", () => {
   closeEntryModal();
 });

 // 6. Copy button for username
 copyUsernameBtn.addEventListener("click", (e) => {
   e.stopPropagation();
   copyTextToClipboard(modalUsername.textContent || "");
 });

 // 7. Copy button for password
 copyPasswordBtn.addEventListener("click", (e) => {
   e.stopPropagation();
   copyTextToClipboard(modalPassword.textContent || "");
 });
