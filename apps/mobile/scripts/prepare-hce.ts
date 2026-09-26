import { createHash, randomUUID } from "node:crypto";
import { rename, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const HCE_SPEC =
  "git+https://github.com/appidea/react-native-hce.git#12468c5abb0c186559ec6201d9fa9da2ae439fe8";
const HCE_NAMESPACE = "com.reactnativehce";
const GRADLE_PRISTINE_SHA256 = "5ca5a6c1d7d54ad78f6353ca711d3915a458fa2398cf1c05902252c36cf4b9c8";
const MANIFEST_PRISTINE_SHA256 = "1a5a89f87c04c2582d7e1a2efc84dda68ac70a78d30c02d661e98a8b34a43ccf";
const NAMESPACE_LINE = `  namespace "${HCE_NAMESPACE}"\n`;
const PRISTINE_MANIFEST_OPEN = `<manifest xmlns:android="http://schemas.android.com/apk/res/android"
          package="${HCE_NAMESPACE}">`;
const PREPARED_MANIFEST_OPEN =
  '<manifest xmlns:android="http://schemas.android.com/apk/res/android">';
const mobileRoot = join(import.meta.dir, "..");

function sha256(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

async function replaceDetached(path: string, content: string) {
  const temporaryPath = `${path}.tap-${process.pid}-${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, content, { encoding: "utf8", flag: "wx" });
    await rename(temporaryPath, path);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw new Error(`Could not safely replace ${path}`, { cause: error });
  }
}

async function writePrepared(path: string, current: string, prepared: string) {
  const before = await stat(path);
  if (current !== prepared || before.nlink > 1) {
    await replaceDetached(path, prepared);
  }

  if ((await Bun.file(path).text()) !== prepared || (await stat(path)).nlink !== 1) {
    throw new Error(`Prepared dependency file is invalid or still hard-linked: ${path}`);
  }
}

const mobilePackage = (await Bun.file(join(mobileRoot, "package.json")).json()) as {
  dependencies?: Record<string, string>;
};
if (mobilePackage.dependencies?.["react-native-hce"] !== HCE_SPEC) {
  throw new Error(`react-native-hce must be pinned to ${HCE_SPEC}`);
}

const require = createRequire(join(mobileRoot, "package.json"));
let hcePackagePath: string;
try {
  hcePackagePath = require.resolve("react-native-hce/package.json");
} catch (error) {
  throw new Error("Could not locate node_modules/react-native-hce", { cause: error });
}

const hceRoot = dirname(hcePackagePath);
const gradlePath = join(hceRoot, "android", "build.gradle");
const manifestPath = join(hceRoot, "android", "src", "main", "AndroidManifest.xml");
for (const file of [
  gradlePath,
  manifestPath,
  join(hceRoot, "src", "index.ts"),
  join(hceRoot, "tsconfig.json"),
]) {
  if (!(await Bun.file(file).exists())) {
    throw new Error(`Pinned react-native-hce checkout is missing ${file}`);
  }
}

const hcePackage = (await Bun.file(hcePackagePath).json()) as {
  main?: string;
  types?: string;
  scripts?: Record<string, string>;
};
if (
  hcePackage.main !== "dist/index.js" ||
  hcePackage.types !== "dist/index.d.ts" ||
  !hcePackage.scripts?.build
) {
  throw new Error("Pinned react-native-hce package entry points or build script changed");
}

const currentGradle = await Bun.file(gradlePath).text();
const namespacePattern = /^[ \t]*namespace\b[^\r\n]*(?:\r?\n|$)/gm;
const namespaceLines = [...currentGradle.matchAll(namespacePattern)];
if (namespaceLines.length > 1 || (namespaceLines[0] && namespaceLines[0][0] !== NAMESPACE_LINE)) {
  throw new Error("react-native-hce build.gradle has an unexpected namespace declaration");
}
const pristineGradle = currentGradle.replace(namespacePattern, "");
if (sha256(pristineGradle) !== GRADLE_PRISTINE_SHA256) {
  throw new Error("react-native-hce build.gradle does not match the pinned pristine SHA-256");
}

const androidBlockPattern = /^android[ \t]*\{[ \t]*\n/gm;
const androidBlocks = [...pristineGradle.matchAll(androidBlockPattern)];
if (androidBlocks.length !== 1) {
  throw new Error("Could not find the expected android block in react-native-hce build.gradle");
}
const preparedGradle = pristineGradle.replace(androidBlockPattern, `android {\n${NAMESPACE_LINE}`);

const currentManifest = await Bun.file(manifestPath).text();
let pristineManifest: string;
if (currentManifest.includes(PRISTINE_MANIFEST_OPEN)) {
  pristineManifest = currentManifest;
} else if (currentManifest.includes(PREPARED_MANIFEST_OPEN)) {
  pristineManifest = currentManifest.replace(PREPARED_MANIFEST_OPEN, PRISTINE_MANIFEST_OPEN);
} else {
  throw new Error("react-native-hce manifest does not contain the expected manifest declaration");
}
if (sha256(pristineManifest) !== MANIFEST_PRISTINE_SHA256) {
  throw new Error("react-native-hce manifest does not match the pinned pristine SHA-256");
}
const preparedManifest = pristineManifest.replace(PRISTINE_MANIFEST_OPEN, PREPARED_MANIFEST_OPEN);

await writePrepared(gradlePath, currentGradle, preparedGradle);
await writePrepared(manifestPath, currentManifest, preparedManifest);

const finalGradle = await Bun.file(gradlePath).text();
if ([...finalGradle.matchAll(namespacePattern)].length !== 1 || finalGradle.includes("jcenter(")) {
  throw new Error("Prepared react-native-hce Gradle configuration is invalid");
}
const finalManifest = await Bun.file(manifestPath).text();
if (finalManifest !== preparedManifest || finalManifest.includes(`package="${HCE_NAMESPACE}"`)) {
  throw new Error("Prepared react-native-hce manifest is invalid");
}

const build = Bun.spawn([process.execPath, "run", "build"], {
  cwd: hceRoot,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});
if ((await build.exited) !== 0) {
  throw new Error("react-native-hce upstream build failed");
}

for (const output of ["dist/index.js", "dist/index.d.ts"]) {
  const outputPath = join(hceRoot, output);
  if (!(await Bun.file(outputPath).exists()) || (await stat(outputPath)).size === 0) {
    throw new Error(`react-native-hce build did not produce ${output}`);
  }
}

console.log(`Prepared detached react-native-hce at ${hceRoot}`);
