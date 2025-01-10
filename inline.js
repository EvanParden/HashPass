// inline.js
const fs = require("fs");
const path = require("path");

// 1. Path to your template HTML (the original src/index.html)
const templatePath = path.join(__dirname, "src", "index.html");

// 2. The dist folder where your CSS & JS were generated
const distPath = path.join(__dirname, "dist");

// 3. The final single-file HTML path
const outPath = path.join(distPath, "index.html");

// 4. The compiled CSS & JS
const cssPath = path.join(distPath, "tailwind.css");
const jsPath = path.join(distPath, "bundle.js");

// Load the original index.html
let inlinedHtml = fs.readFileSync(templatePath, "utf-8");

// Inline CSS into <head>
if (fs.existsSync(cssPath)) {
  const cssContent = fs.readFileSync(cssPath, "utf-8");
  inlinedHtml = inlinedHtml.replace(
    "</head>",
    `<style>${cssContent}</style>\n</head>`
  );
}

// Inline JS before </body>
if (fs.existsSync(jsPath)) {
  const jsContent = fs.readFileSync(jsPath, "utf-8");
  inlinedHtml = inlinedHtml.replace(
    "</body>",
    `<script>${jsContent}</script>\n</body>`
  );
}

// Write final single-file output
fs.writeFileSync(outPath, inlinedHtml, "utf-8");
console.log("Successfully inlined CSS & JS into dist/index.html!");
