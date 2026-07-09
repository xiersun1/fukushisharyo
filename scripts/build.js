const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const src = path.join(root, "src");
const dist = path.join(root, "dist");
const requiredFiles = [
  "index.html",
  "assets/app.js",
  "assets/styles.css",
  "data/sources.json",
  "admin/index.html",
  "admin/config.yml"
];

function removeDir(target) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const fromPath = path.join(from, entry.name);
    const toPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyDir(fromPath, toPath);
    } else {
      fs.copyFileSync(fromPath, toPath);
    }
  }
}

function assertFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${path.relative(root, filePath)}`);
  }
}

function validateSources() {
  const dataPath = path.join(src, "data", "sources.json");
  const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  if (!data.updatedAt || !Array.isArray(data.sources)) {
    throw new Error("sources.json must include updatedAt and sources[]");
  }
  for (const source of data.sources) {
    for (const key of ["title", "org", "status", "region", "period", "target", "summary", "url"]) {
      if (!source[key]) {
        throw new Error(`sources.json missing ${key}: ${source.title || "(no title)"}`);
      }
    }
  }
}

for (const file of requiredFiles) {
  assertFile(path.join(src, file));
}

validateSources();
removeDir(dist);
copyDir(src, dist);

console.log(`Built ${path.relative(root, dist)} from ${path.relative(root, src)}`);
