import { readdir, readFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

type Finding = {
  file: string;
  line: number;
  rule: string;
  message: string;
};

const root = resolve(import.meta.dir, "..");
const codeExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const ignoredDirectories = new Set([
  ".git",
  ".expo",
  "node_modules",
  "dist",
  "out",
  "cache",
  "android",
  "ios",
]);

function extension(path: string): string {
  const index = path.lastIndexOf(".");
  return index === -1 ? "" : path.slice(index);
}

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory() && normalized(path) === "contracts/lib") continue;
    if (entry.isDirectory()) files.push(...(await collectFiles(path)));
    if (entry.isFile() && codeExtensions.has(extension(entry.name))) files.push(path);
  }
  return files;
}

function normalized(path: string): string {
  return relative(root, path).split(sep).join("/");
}

function addMatches(
  findings: Finding[],
  file: string,
  source: string,
  rule: string,
  message: string,
  pattern: RegExp,
): void {
  source.split(/\r?\n/).forEach((line, index) => {
    pattern.lastIndex = 0;
    if (pattern.test(line)) findings.push({ file, line: index + 1, rule, message });
  });
}

function addressAllowed(file: string): boolean {
  return (
    file === "packages/core/src/config/chains.ts" ||
    file.startsWith("contracts/") ||
    file.startsWith("scripts/") ||
    file.includes("/test/") ||
    file.includes("/fixtures/")
  );
}

const findings: Finding[] = [];
const files = await collectFiles(root);

for (const path of files) {
  const file = normalized(path);
  const source = await readFile(path, "utf8");
  const isCore = file.startsWith("packages/core/src/");
  const isMobile = file.startsWith("apps/mobile/");

  if (isCore || isMobile) {
    addMatches(
      findings,
      file,
      source,
      "INV-12",
      "amount code must not use floating-point helpers",
      /parseFloat\s*\(|\.toFixed\s*\(/,
    );
  }
  if (file.startsWith("packages/core/src/payment/") || file === "packages/core/src/format.ts") {
    addMatches(
      findings,
      file,
      source,
      "INV-12",
      "amount code must not convert through Number",
      /\bNumber\s*\(/,
    );
  }
  if (isCore) {
    addMatches(
      findings,
      file,
      source,
      "INV-13",
      "@tap/core must not import React Native or Expo",
      /(?:from\s+|import\s*\()["'](?:react-native|expo)(?:[/'"])/,
    );
    addMatches(
      findings,
      file,
      source,
      "LAYERING",
      "@tap/core must not import @tap/react-native",
      /["']@tap\/react-native(?:[/'"])/,
    );
  }
  if (isMobile) {
    addMatches(
      findings,
      file,
      source,
      "INV-14",
      "mobile code must not import viem",
      /(?:from\s+|import\s*\()["']viem(?:[/'"])/,
    );
    addMatches(
      findings,
      file,
      source,
      "INV-14",
      "mobile code must not import ABI modules",
      /(?:from\s+|import\s*\()["'][^"']*(?:^|\/)abi["']\)?/i,
    );
  }
  if (file.startsWith("packages/react-native/") && /["'](?:\.\.\/)*apps\//.test(source)) {
    findings.push({
      file,
      line: 1,
      rule: "LAYERING",
      message: "@tap/react-native must not import from apps",
    });
  }
  if (!addressAllowed(file)) {
    addMatches(
      findings,
      file,
      source,
      "INV-15",
      "address literal is outside an allowed path",
      /0x[0-9a-fA-F]{40}\b/,
    );
  }
  addMatches(
    findings,
    file,
    source,
    "INV-16",
    "never log private keys or PK environment variables",
    /console\.[a-z]+.*(?:privateKey|PRIVATE_KEY|\b[A-Z_]*_PK\b)/i,
  );
}

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line} [${finding.rule}] ${finding.message}`);
  }
  process.exit(1);
}

console.log("Architecture checks passed.");
