import { parseConfigFileTextToJson } from "typescript";
import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
await mkdir("worker-upload", { recursive: true });
await build({
  entryPoints: ["worker.ts"],
  bundle: true,
  format: "esm",
  target: "es2022",
  platform: "neutral",
  outfile: "worker-upload/worker.mjs",
  minify: false,
});
const config = parseConfigFileTextToJson("wrangler.jsonc", await readFile("wrangler.jsonc", "utf8")).config;
config.main = "worker.mjs";
delete config.$schema;
await writeFile(
  "worker-upload/wrangler.jsonc",
  JSON.stringify(config, null, 2) + "\n",
);
console.log("Worker-Paket in worker-upload bereit.");
