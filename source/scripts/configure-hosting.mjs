import { parseConfigFileTextToJson } from "typescript";
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
const rl = createInterface({ input: stdin, output: stdout });
try {
  console.log("\nWorld Empire – Cloudflare Pages & Worker konfigurieren\n");
  const pageAnswer = (
    await rl.question("Pages-Adresse (z. B. https://mein-imperium.pages.dev): ")
  ).trim();
  const pages = new URL(pageAnswer);
  if (pages.protocol !== "https:")
    throw new Error("Die Pages-Adresse muss HTTPS verwenden.");
  const workerAnswer = (
    await rl.question(
      "Worker-Adresse (https://world-empire-api.DEIN-NAME.workers.dev): ",
    )
  ).trim();
  const worker = new URL(workerAnswer);
  if (worker.protocol !== "https:")
    throw new Error("Die Worker-Adresse muss HTTPS verwenden.");
  const config = parseConfigFileTextToJson("wrangler.jsonc",
    await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
  ).config;
  config.vars.ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    pages.origin,
  ].join(",");
  await writeFile(
    new URL("../wrangler.jsonc", import.meta.url),
    JSON.stringify(config, null, 2) + "\n",
  );
  const runtime = JSON.stringify({ apiBase: worker.origin }, null, 2) + "\n";
  await writeFile(new URL("../public/config.json", import.meta.url), runtime);
  try {
    await writeFile(new URL("../dist/config.json", import.meta.url), runtime);
  } catch {}
  console.log(
    "\nKonfiguration gespeichert. Jetzt: npm run deploy:worker und npm run build. Anschließend den Inhalt von dist bei Pages hochladen.",
  );
} finally {
  rl.close();
}
