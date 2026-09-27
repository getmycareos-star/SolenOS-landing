import fs from "node:fs";
import path from "node:path";

const roots = ["src", "scripts", "db", "tests"].filter((p) => fs.existsSync(path.resolve(p)));
const exts = new Set([".ts", ".tsx", ".mts", ".sql"]);
const found: string[] = [];

function walk(dir: string): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".git" || e.name === ".next") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(full);
      continue;
    }
    if (!exts.has(path.extname(e.name))) continue;
    const fd = fs.openSync(full, "r");
    const buf = Buffer.alloc(2);
    const read = fs.readSync(fd, buf, 0, 2, 0);
    fs.closeSync(fd);
    if (read === 2 && buf[0] === 0xff && buf[1] === 0xfe) found.push(full);
  }
}

for (const r of roots) walk(r);
console.log(`UTF16 FILES: ${found.length}`);
for (const f of found) console.log(f);
