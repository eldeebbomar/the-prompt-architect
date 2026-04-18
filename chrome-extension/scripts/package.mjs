#!/usr/bin/env node
/**
 * Builds the Chrome Web Store upload zip.
 *
 * Usage: node scripts/package.mjs
 * Output: ../dist/lovplan-deployer-v{version}.zip
 *
 * Deliberately excludes: markdown docs, store assets, package.json/scripts
 * for this tooling, node_modules, VCS/OS cruft. The zip contains only the
 * files the browser actually loads.
 */

import { createWriteStream, readFileSync, existsSync, mkdirSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = dirname(__dirname);

const manifest = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8"));
const version = manifest.version;

// Hard-fail if any required field is missing so we can't accidentally
// ship a zip that the Web Store will reject.
for (const field of ["name", "version", "manifest_version"]) {
  if (!manifest[field]) {
    console.error(`manifest.json is missing required field "${field}"`);
    process.exit(1);
  }
}

const DIST_DIR = join(ROOT, "dist");
if (!existsSync(DIST_DIR)) mkdirSync(DIST_DIR);
const OUT = join(DIST_DIR, `lovplan-deployer-v${version}.zip`);

// Files/dirs we never ship. Anything not explicitly listed ships.
const EXCLUDE_DIRS = new Set([
  "node_modules",
  "dist",
  "scripts",
  "store-assets",
  ".git",
  ".vscode",
  ".idea",
]);
const EXCLUDE_FILES = new Set([
  ".DS_Store",
  "Thumbs.db",
  "package.json",
  "package-lock.json",
  "PRIVACY.md",
  "PUBLISH_CHECKLIST.md",
]);
const EXCLUDE_SUFFIXES = [".md", ".swp", ".swo", ".log"];

async function walk(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      out.push(...(await walk(full)));
    } else {
      if (EXCLUDE_FILES.has(entry.name)) continue;
      if (EXCLUDE_SUFFIXES.some((s) => entry.name.endsWith(s))) continue;
      out.push(full);
    }
  }
  return out;
}

// Minimal zip writer (DEFLATE) so we don't need a dependency.
// Based on the PKZIP APPNOTE format; good enough for Chrome Web Store.
import { deflateRaw } from "node:zlib";
import { promisify } from "node:util";
const deflate = promisify(deflateRaw);

function dosTime(date) {
  return (
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    (Math.floor(date.getSeconds() / 2) & 0x1f)
  );
}
function dosDate(date) {
  return (
    (((date.getFullYear() - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0xf) << 5) |
    (date.getDate() & 0x1f)
  );
}

function crc32(buf) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function main() {
  const files = (await walk(ROOT)).sort();
  if (files.length === 0) {
    console.error("No files to package.");
    process.exit(1);
  }

  const out = createWriteStream(OUT);
  const entries = [];
  let offset = 0;

  for (const full of files) {
    const name = relative(ROOT, full).split("\\").join("/");
    const raw = readFileSync(full);
    const compressed = await deflate(raw, { level: 9 });
    const useDeflate = compressed.length < raw.length;
    const data = useDeflate ? compressed : raw;
    const method = useDeflate ? 8 : 0;
    const { mtime } = await stat(full);
    const t = dosTime(mtime);
    const d = dosDate(mtime);
    const crc = crc32(raw);

    const nameBuf = Buffer.from(name, "utf8");
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 names
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(t, 10);
    localHeader.writeUInt16LE(d, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(raw.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    out.write(localHeader);
    out.write(nameBuf);
    out.write(data);

    entries.push({
      name: nameBuf,
      method,
      t,
      d,
      crc,
      compSize: data.length,
      rawSize: raw.length,
      offset,
    });
    offset += localHeader.length + nameBuf.length + data.length;
  }

  const centralStart = offset;
  for (const e of entries) {
    const hdr = Buffer.alloc(46);
    hdr.writeUInt32LE(0x02014b50, 0);
    hdr.writeUInt16LE(20, 4);
    hdr.writeUInt16LE(20, 6);
    hdr.writeUInt16LE(0x0800, 8);
    hdr.writeUInt16LE(e.method, 10);
    hdr.writeUInt16LE(e.t, 12);
    hdr.writeUInt16LE(e.d, 14);
    hdr.writeUInt32LE(e.crc, 16);
    hdr.writeUInt32LE(e.compSize, 20);
    hdr.writeUInt32LE(e.rawSize, 24);
    hdr.writeUInt16LE(e.name.length, 28);
    hdr.writeUInt16LE(0, 30);
    hdr.writeUInt16LE(0, 32);
    hdr.writeUInt16LE(0, 34);
    hdr.writeUInt16LE(0, 36);
    hdr.writeUInt32LE(0, 38);
    hdr.writeUInt32LE(e.offset, 42);
    out.write(hdr);
    out.write(e.name);
    offset += hdr.length + e.name.length;
  }
  const centralSize = offset - centralStart;

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralStart, 16);
  end.writeUInt16LE(0, 20);
  out.write(end);

  out.end(() => {
    const hash = createHash("sha256")
      .update(readFileSync(OUT))
      .digest("hex")
      .slice(0, 12);
    console.log(`✓ built ${relative(ROOT, OUT)}`);
    console.log(`  version: ${version}`);
    console.log(`  files:   ${files.length}`);
    console.log(`  sha256:  ${hash}…`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
