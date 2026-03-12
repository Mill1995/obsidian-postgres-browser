import { copyFileSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";

// Load .env file
try {
	const env = readFileSync(".env", "utf8");
	for (const line of env.split("\n")) {
		const match = line.match(/^\s*([\w]+)\s*=\s*(.+)\s*$/);
		if (match) process.env[match[1]] = match[2];
	}
} catch {}

const dest = process.env.VAULT_PLUGIN_DIR;
if (!dest) {
	console.error("VAULT_PLUGIN_DIR is not set. Create a .env file with:\nVAULT_PLUGIN_DIR=/path/to/vault/.obsidian/plugins/postgres-browser");
	process.exit(1);
}

mkdirSync(dest, { recursive: true });

for (const file of ["main.js", "manifest.json", "styles.css"]) {
	copyFileSync(file, join(dest, file));
}

console.log(`Copied main.js, manifest.json, styles.css → ${dest}`);
