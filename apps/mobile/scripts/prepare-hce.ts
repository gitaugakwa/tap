import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const HCE_SPEC =
  "git+https://github.com/appidea/react-native-hce.git#12468c5abb0c186559ec6201d9fa9da2ae439fe8";
const HCE_NAMESPACE = "com.reactnativehce";
const mobileRoot = join(import.meta.dir, "..");

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
const requiredFiles = [
  gradlePath,
  join(hceRoot, "src", "index.ts"),
  join(hceRoot, "tsconfig.json"),
];
for (const file of requiredFiles) {
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

let gradle = await Bun.file(gradlePath).text();
if (gradle.includes("jcenter(")) {
  throw new Error("Pinned react-native-hce unexpectedly contains jcenter()");
}

const namespacePattern = /^[ \t]*namespace[ \t]+["']([^"']+)["'][ \t]*\r?$/gm;
const namespaces = [...gradle.matchAll(namespacePattern)];
if (namespaces.length > 1 || (namespaces[0] && namespaces[0][1] !== HCE_NAMESPACE)) {
  throw new Error("react-native-hce android/build.gradle has an unexpected namespace declaration");
}

if (namespaces.length === 0) {
  const androidBlockPattern = /^android[ \t]*\{[ \t]*\r?$/gm;
  const androidBlocks = [...gradle.matchAll(androidBlockPattern)];
  if (androidBlocks.length !== 1) {
    throw new Error("Could not find the expected android block in react-native-hce build.gradle");
  }

  const newline = gradle.includes("\r\n") ? "\r\n" : "\n";
  gradle = gradle.replace(androidBlockPattern, `android {${newline}  namespace "${HCE_NAMESPACE}"`);
  await Bun.write(gradlePath, gradle);
}

const preparedGradle = await Bun.file(gradlePath).text();
const preparedNamespaces = [...preparedGradle.matchAll(namespacePattern)];
if (preparedNamespaces.length !== 1 || preparedNamespaces[0]?.[1] !== HCE_NAMESPACE) {
  throw new Error("react-native-hce namespace preparation did not produce exactly one declaration");
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
  if (!(await Bun.file(join(hceRoot, output)).exists())) {
    throw new Error(`react-native-hce build did not produce ${output}`);
  }
}

console.log(`Prepared react-native-hce at ${hceRoot}`);
