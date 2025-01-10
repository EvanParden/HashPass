// src/app.ts

/*******************************************************
 * Types
 *******************************************************/
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

 /*******************************************************
  * DOM Elements
  *******************************************************/
 // File load + valid check
 const jsonFileInput = document.getElementById("jsonFileInput") as HTMLInputElement;
 const validIcon = document.getElementById("validIcon") as SVGElement | null;
 const loadJsonBtn = document.getElementById("loadJsonBtn") as HTMLButtonElement;

 // Create new storage
 const openCreateModalBtn = document.getElementById("openCreateModalBtn") as HTMLButtonElement;
 const createStorageModal = document.getElementById("createStorageModal") as HTMLDivElement;
 const closeCreateModalBtn = document.getElementById("closeCreateModalBtn") as HTMLButtonElement;
 const createMasterPasswordInput = document.getElementById("createMasterPasswordInput") as HTMLInputElement;
 const createStorageBtn = document.getElementById("createStorageBtn") as HTMLButtonElement;

 // Entries container
 const entriesContainer = document.getElementById("entriesContainer") as HTMLDivElement;

 // Add entry
 const openAddEntryBtn = document.getElementById("openAddEntryBtn") as HTMLButtonElement;
 const addEntryModal = document.getElementById("addEntryModal") as HTMLDivElement;
 const closeAddEntryModalBtn = document.getElementById("closeAddEntryModalBtn") as HTMLButtonElement;
 const websiteInput = document.getElementById("websiteInput") as HTMLInputElement;
 const usernameInput = document.getElementById("usernameInput") as HTMLInputElement;
 const passwordInput = document.getElementById("passwordInput") as HTMLInputElement;
 const noteInput = document.getElementById("noteInput") as HTMLTextAreaElement;
 const submitNewEntryBtn = document.getElementById("submitNewEntryBtn") as HTMLButtonElement;

 // Detail modal (for notes, etc.)
 const detailModal = document.getElementById("detailModal") as HTMLDivElement;
 const closeDetailModalBtn = document.getElementById("closeDetailModalBtn") as HTMLButtonElement;
 const detailWebsite = document.getElementById("detailWebsite") as HTMLSpanElement;
 const detailUsername = document.getElementById("detailUsername") as HTMLSpanElement;
 const detailPassword = document.getElementById("detailPassword") as HTMLSpanElement;
 const detailNotes = document.getElementById("detailNotes") as HTMLParagraphElement;

 // Save & Download
 const downloadJsonBtn = document.getElementById("downloadJsonBtn") as HTMLButtonElement;

 /*******************************************************
  * Global State
  *******************************************************/
 let entries: PasswordEntry[] = [];
 let masterPassword: string = "";  // from user loading or creating
 let currentSalt: Uint8Array | null = null;
 let currentIV: Uint8Array | null = null;

 /*******************************************************
  * Base64 Helpers
  *******************************************************/
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

 /*******************************************************
  * Crypto: Derive Key, Encrypt, Decrypt
  *******************************************************/
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

 async function encryptWithPassword(password: string, plainData: string): Promise<EncryptedStore> {
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

 async function decryptWithPassword(password: string, store: EncryptedStore): Promise<string> {
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

 /*******************************************************
  * Encrypt / Decrypt Entries
  *******************************************************/
 async function encryptEntries(
   password: string,
   entries: PasswordEntry[]
 ): Promise<string> {
   const data = JSON.stringify(entries);
   // If no password, store in plaintext
   if (!password) {
     return JSON.stringify({ iv: "", salt: "", data }, null, 2);
   }
   const store = await encryptWithPassword(password, data);
   return JSON.stringify(store, null, 2);
 }

 async function decryptEntries(password: string, fileText: string): Promise<PasswordEntry[]> {
   const parsed = JSON.parse(fileText) as EncryptedStore;
   // If no iv/salt => plaintext
   if (!parsed.iv && !parsed.salt) {
     return JSON.parse(parsed.data);
   } else {
     const plainData = await decryptWithPassword(password, parsed);
     return JSON.parse(plainData);
   }
 }

 /*******************************************************
  * Rendering the List
  *******************************************************/
 function renderEntries() {
   entriesContainer.innerHTML = "";

   if (entries.length === 0) {
     const emptyMsg = document.createElement("div");
     emptyMsg.className = "text-gray-500 text-center p-4";
     emptyMsg.textContent = "No entries yet";
     entriesContainer.appendChild(emptyMsg);
     return;
   }

   entries.forEach((entry, idx) => {
     const card = document.createElement("div");
     card.className = "p-3 border rounded flex items-center justify-between hover:bg-gray-50";

     // Left side: website & username
     const leftDiv = document.createElement("div");
     leftDiv.className = "flex flex-col";

     const websiteSpan = document.createElement("span");
     websiteSpan.className = "font-semibold text-gray-700";
     websiteSpan.textContent = entry.website;

     const usernameSpan = document.createElement("span");
     usernameSpan.className = "text-gray-600 text-sm";
     usernameSpan.textContent = entry.username || "(no username)";

     leftDiv.appendChild(websiteSpan);
     leftDiv.appendChild(usernameSpan);

     // Right side: masked password + "details" button
     const rightDiv = document.createElement("div");
     rightDiv.className = "flex items-center gap-3";

     // Masked password, clicking toggles reveal
     const pwSpan = document.createElement("span");
     pwSpan.className = "bg-gray-200 text-sm px-2 py-1 rounded cursor-pointer";
     pwSpan.textContent = "••••••••";

     let shown = false;
     pwSpan.addEventListener("click", () => {
       if (shown) {
         pwSpan.textContent = "••••••••";
       } else {
         pwSpan.textContent = entry.password || "";
       }
       shown = !shown;
     });

     // "Details" button if you want to see notes or more info
     const detailBtn = document.createElement("button");
     detailBtn.className = "text-xs bg-gray-300 px-2 py-1 rounded hover:bg-gray-400";
     detailBtn.textContent = "Details";
     detailBtn.addEventListener("click", (e) => {
       e.stopPropagation(); // prevent toggling the password
       openDetailModal(entry);
     });

     rightDiv.appendChild(pwSpan);
     rightDiv.appendChild(detailBtn);

     // Attach everything
     card.appendChild(leftDiv);
     card.appendChild(rightDiv);
     entriesContainer.appendChild(card);
   });
 }

 function openDetailModal(entry: PasswordEntry) {
   detailWebsite.textContent = entry.website;
   detailUsername.textContent = entry.username;
   detailPassword.textContent = entry.password;
   detailNotes.textContent = entry.note;

   detailModal.classList.remove("hidden");
 }
 function closeDetailModal() {
   detailModal.classList.add("hidden");
 }

 /*******************************************************
  * Event Listeners
  *******************************************************/

 // (A) JSON file input => check validity (green check)
 jsonFileInput.addEventListener("change", async () => {
   validIcon?.classList.add("hidden");
   const file = jsonFileInput.files?.[0];
   if (!file) return;

   try {
     const text = await file.text();
     JSON.parse(text); // Just parse to test
     validIcon?.classList.remove("hidden");
   } catch (err) {
     // Invalid JSON => keep hidden
     console.warn("Invalid JSON format", err);
   }
 });

 // (B) Load JSON
 loadJsonBtn.addEventListener("click", async () => {
   const file = jsonFileInput.files?.[0];
   if (!file) {
     alert("No file selected");
     return;
   }
   try {
     const text = await file.text();
     // Prompt user for password (optional)
     const userPass = prompt("Enter master password if any (or leave blank):") || "";
     masterPassword = userPass;

     const decryptedEntries = await decryptEntries(userPass, text);

     // If the file was encrypted, set the salt/iv so we can re-encrypt
     const parsed = JSON.parse(text);
     if (parsed.iv && parsed.salt) {
       currentSalt = new Uint8Array(base64ToArrayBuffer(parsed.salt));
       currentIV   = new Uint8Array(base64ToArrayBuffer(parsed.iv));
     } else {
       currentSalt = null;
       currentIV = null;
     }

     entries = decryptedEntries;
     renderEntries();
     alert("File loaded successfully");
   } catch (err) {
     console.error(err);
     alert("Failed to load/decrypt file. Check console for details.");
   }
 });

 // (C) Open Create Storage Modal
 openCreateModalBtn.addEventListener("click", () => {
   createStorageModal.classList.remove("hidden");
 });
 closeCreateModalBtn.addEventListener("click", () => {
   createStorageModal.classList.add("hidden");
 });

 // (D) Create Storage
 createStorageBtn.addEventListener("click", () => {
   // user can set or skip the password
   masterPassword = createMasterPasswordInput.value || "";
   entries = [];
   currentSalt = null;
   currentIV = null;
   renderEntries();

   createStorageModal.classList.add("hidden");
   createMasterPasswordInput.value = "";
   alert("New storage created!");
 });

 // (E) Open Add Entry Modal
 openAddEntryBtn.addEventListener("click", () => {
   addEntryModal.classList.remove("hidden");
 });
 closeAddEntryModalBtn.addEventListener("click", () => {
   addEntryModal.classList.add("hidden");
 });

 // (F) Submit New Entry
 submitNewEntryBtn.addEventListener("click", () => {
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

   addEntryModal.classList.add("hidden");
   renderEntries();
 });

 // (G) Detail modal
 closeDetailModalBtn.addEventListener("click", () => {
   closeDetailModal();
 });

 // (H) Download JSON
 downloadJsonBtn.addEventListener("click", async () => {
   try {
     // if user loaded with password or created with password, re-encrypt with that
     const content = await encryptEntries(masterPassword, entries);
     const blob = new Blob([content], { type: "application/json" });
     const url = URL.createObjectURL(blob);
     const a = document.createElement("a");
     a.href = url;
     a.download = "passwords.json";
     a.click();
     URL.revokeObjectURL(url);
   } catch (err) {
     console.error(err);
     alert("Failed to save. Check console.");
   }
 });
