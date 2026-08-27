#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec "${script_dir}/sites-env.sh" -- "$0" "$@"
fi

worker="${SITES_PROJECT_ROOT}/dist/server/index.js"
hosting="${SITES_PROJECT_ROOT}/dist/.openai/hosting.json"

[[ -f "${worker}" ]] || {
  echo "Missing Sites Worker entry: dist/server/index.js" >&2
  exit 66
}
[[ -f "${hosting}" ]] || {
  echo "Missing packaged Sites manifest: dist/.openai/hosting.json" >&2
  exit 66
}

node --input-type=module - "${worker}" "${hosting}" <<'NODE'
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const [workerPath, hostingPath] = process.argv.slice(2);
const hosting = JSON.parse(await readFile(hostingPath, "utf8"));
const source = await readFile(workerPath, "utf8");

if (source.includes('from "cloudflare:workers"')) {
  const hasFetch = /async\s+fetch\s*\(/.test(source);
  const hasDefault = /export\s*\{[^}]+\bas\s+default\b[^}]*\}/s.test(source);
  if (!hasFetch || !hasDefault) {
    throw new Error("dist/server/index.js must have an ESM default export with fetch(request, env, ctx)");
  }
} else {
  const workerUrl = pathToFileURL(workerPath);
  workerUrl.searchParams.set("sites-validation", `${process.pid}-${Date.now()}`);
  const worker = await import(workerUrl.href);
  if (!worker.default || typeof worker.default.fetch !== "function") {
    throw new Error("dist/server/index.js must have an ESM default export with fetch(request, env, ctx)");
  }
}

if (hosting.d1 && !source.includes("cloudflare:workers")) {
  throw new Error("D1 binding is declared but the Worker has no Cloudflare runtime import");
}
NODE

echo "Validated Sites artifact: ESM Worker default.fetch and hosting manifest are present."
