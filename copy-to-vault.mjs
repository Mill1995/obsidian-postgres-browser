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

const vault = process.env.OBSIDIAN_VAULT;
if (!vault) {
	console.error(
		"OBSIDIAN_VAULT is not set. Create a .env file with:\nOBSIDIAN_VAULT=/path/to/vault"
	);
	process.exit(1);
}

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const dest = join(vault, ".obsidian", "plugins", manifest.id);

mkdirSync(dest, { recursive: true });

for (const file of ["main.js", "manifest.json", "styles.css"]) {
	copyFileSync(file, join(dest, file));
}

console.log(`Copied main.js, manifest.json, styles.css → ${dest}`);
