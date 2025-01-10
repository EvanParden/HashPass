// inline.js
const fs = require("fs");
const path = require("path");

const templatePath = path.join(__dirname, "src", "index.html");
const distPath = path.join(__dirname, "dist");
const outPath = path.join(distPath, "index.html");

const cssPath = path.join(distPath, "tailwind.css");
const jsPath = path.join(distPath, "bundle.js");

const templateHtml = fs.readFileSync(templatePath, "utf-8");

let inlinedHtml = templateHtml;

// Inline CSS
if (fs.existsSync(cssPath)) {
  const cssContent = fs.readFileSync(cssPath, "utf-8");
  inlinedHtml = inlinedHtml.replace(
    "</head>",
    `<style>${cssContent}</style>\n</head>`
  );
}

// Inline JS
if (fs.existsSync(jsPath)) {
  const jsContent = fs.readFileSync(jsPath, "utf-8");
  inlinedHtml = inlinedHtml.replace(
    "</body>",
    `<script>${jsContent}</script>\n</body>`
  );
}

fs.writeFileSync(outPath, inlinedHtml, "utf-8");
console.log("Successfully inlined CSS & JS into dist/index.html!");
