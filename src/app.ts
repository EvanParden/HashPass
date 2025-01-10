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

 interface DataContent {
   metadata: {
     algorithm: string;
     securityLevel: string;
   };
   entries: PasswordEntry[];
 }

 interface EncryptedStore {
   iv: string;
   salt: string;
   data: string;
 }

 /*******************************************************
  * DOM Elements
  *******************************************************/
 // File load + valid check
 const jsonFileInput = document.getElementById("jsonFileInput") as HTMLInputElement;
 const validIcon = document.getElementById("validIcon") as SVGElement | null;
 const loadJsonBtn = document.getElementById("loadJsonBtn") as HTMLButtonElement;

 // Metadata display
 const metadataDisplay = document.getElementById("metadataDisplay") as HTMLDivElement;
 const algoLabel = document.getElementById("algoLabel") as HTMLSpanElement;
 const secLevelLabel = document.getElementById("secLevelLabel") as HTMLSpanElement;

 // Create new storage
 const openCreateModalBtn = document.getElementById("openCreateModalBtn") as HTMLButtonElement;
 const createStorageModal = document.getElementById("createStorageModal") as HTMLDivElement;
 const closeCreateModalBtn = document.getElementById("closeCreateModalBtn") as HTMLButtonElement;
 const createMasterPasswordInput = document.getElementById("createMasterPasswordInput") as HTMLInputElement;
 const algorithmSelect = document.getElementById("algorithmSelect") as HTMLSelectElement;
 const securityLevelSelect = document.getElementById("securityLevelSelect") as HTMLSelectElement;
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

 // Detail modal
 const detailModal = document.getElementById("detailModal") as HTMLDivElement;
 const closeDetailModalBtn = document.getElementById("closeDetailModalBtn") as HTMLButtonElement;
 const detailWebsite = document.getElementById("detailWebsite") as HTMLSpanElement;
 const detailUsername = document.getElementById("detailUsername") as HTMLSpanElement;
 const detailPassword = document.getElementById("detailPassword") as HTMLSpanElement;
 const detailNotes = document.getElementById("detailNotes") as HTMLParagraphElement;

 // Save & Download
 const saveJsonBtn = document.getElementById("saveJsonBtn") as HTMLButtonElement;

 /*******************************************************
  * Global State
  *******************************************************/
 let masterPassword = "";
 let currentSalt: Uint8Array | null = null;
 let currentIV: Uint8Array | null = null;

 let dataContent: DataContent = {
   metadata: {
     algorithm: "AES-GCM",
     securityLevel: "256-bit",
   },
   entries: [],
 };

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
  * Crypto
  *******************************************************/
 // We always use AES-GCM for actual encryption. The user’s selected
 // "algorithm" is stored in metadata but not currently used in the cipher.
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
  * Build / Parse JSON
  *******************************************************/
 async function buildJson(): Promise<string> {
   if (!masterPassword) {
     // Plain text if no password
     return JSON.stringify({
       iv: "",
       salt: "",
       data: JSON.stringify(dataContent),
     }, null, 2);
   } else {
     // Encrypted
     const plainData = JSON.stringify(dataContent);
     const store = await encryptWithPassword(masterPassword, plainData);
     return JSON.stringify(store, null, 2);
   }
 }

 async function parseJson(jsonText: string, userPass: string): Promise<DataContent> {
   const parsed = JSON.parse(jsonText) as EncryptedStore;

   // Plain?
   if (!parsed.iv && !parsed.salt) {
     return JSON.parse(parsed.data) as DataContent;
   }

   // Encrypted
   const plain = await decryptWithPassword(userPass, parsed);
   return JSON.parse(plain) as DataContent;
 }

 /*******************************************************
  * Render
  *******************************************************/
 function renderEntries() {
   entriesContainer.innerHTML = "";

   const entries = dataContent.entries;
   if (!entries || entries.length === 0) {
     const emptyMsg = document.createElement("div");
     emptyMsg.className = "text-gray-500 text-center p-4";
     emptyMsg.textContent = "No entries yet";
     entriesContainer.appendChild(emptyMsg);
     return;
   }

   entries.forEach((entry) => {
     const card = document.createElement("div");
     card.className = "p-3 border rounded flex items-center justify-between hover:bg-gray-50";

     // Left side
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

     // Right side: masked password + details
     const rightDiv = document.createElement("div");
     rightDiv.className = "flex items-center gap-3";

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

     const detailBtn = document.createElement("button");
     detailBtn.className = "text-xs bg-gray-300 px-2 py-1 rounded hover:bg-gray-400";
     detailBtn.textContent = "Details";
     detailBtn.addEventListener("click", (e) => {
       e.stopPropagation();
       openDetailModal(entry);
     });

     rightDiv.appendChild(pwSpan);
     rightDiv.appendChild(detailBtn);

     card.appendChild(leftDiv);
     card.appendChild(rightDiv);
     entriesContainer.appendChild(card);
   });
 }

 /*******************************************************
  * Modals
  *******************************************************/
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
  * File Download
  *******************************************************/
 function triggerFileDownload(fileContent: string) {
   const blob = new Blob([fileContent], { type: "application/json" });
   const url = URL.createObjectURL(blob);
   const a = document.createElement("a");
   a.href = url;
   a.download = "passwords.json";
   a.click();
   URL.revokeObjectURL(url);
 }

 /*******************************************************
  * Event Listeners
  *******************************************************/

 // (A) JSON file input => check validity
 jsonFileInput.addEventListener("change", async () => {
   validIcon?.classList.add("hidden");
   metadataDisplay.classList.add("hidden");
   const file = jsonFileInput.files?.[0];
   if (!file) return;

   try {
     const text = await file.text();
     JSON.parse(text); // parse to test
     validIcon?.classList.remove("hidden");
   } catch (err) {
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
     const userPass = prompt("Enter master password if any (or leave blank):") || "";
     masterPassword = userPass;

     const parsedData = await parseJson(text, userPass);

     // If the file was encrypted, set salt/iv
     const storeCheck = JSON.parse(text) as EncryptedStore;
     if (storeCheck.iv && storeCheck.salt) {
       currentSalt = new Uint8Array(base64ToArrayBuffer(storeCheck.salt));
       currentIV   = new Uint8Array(base64ToArrayBuffer(storeCheck.iv));
     } else {
       currentSalt = null;
       currentIV   = null;
     }

     dataContent = parsedData;
     if (!dataContent.metadata) {
       dataContent.metadata = {
         algorithm: "AES-GCM",
         securityLevel: "256-bit",
       };
     }

     // Show metadata
     algoLabel.textContent = dataContent.metadata.algorithm;
     secLevelLabel.textContent = dataContent.metadata.securityLevel;
     metadataDisplay.classList.remove("hidden");

     renderEntries();
     alert("File loaded successfully");
   } catch (err) {
     console.error(err);
     alert("Failed to load/decrypt file. Check console for details.");
   }
 });

 // (C) Open/Close Create Storage Modal
 openCreateModalBtn.addEventListener("click", () => {
   createStorageModal.classList.remove("hidden");
 });
 closeCreateModalBtn.addEventListener("click", () => {
   createStorageModal.classList.add("hidden");
 });

 // (D) Create Storage
 createStorageBtn.addEventListener("click", () => {
   masterPassword = createMasterPasswordInput.value || "";

   dataContent.metadata.algorithm = algorithmSelect.value;
   dataContent.metadata.securityLevel = securityLevelSelect.value;
   dataContent.entries = [];

   currentSalt = null;
   currentIV = null;

   renderEntries();
   createStorageModal.classList.add("hidden");
   createMasterPasswordInput.value = "";

   alert("New storage created! Use 'Save & Download' to export.");
 });

 // (E) Open/Close Add Entry Modal
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
   dataContent.entries.push(newEntry);

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

 // (H) Save & Download
 saveJsonBtn.addEventListener("click", async () => {
   try {
     const content = await buildJson();
     triggerFileDownload(content);
   } catch (err) {
     console.error(err);
     alert("Failed to save. Check console for details.");
   }
 });
