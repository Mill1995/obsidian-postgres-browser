import type { App } from "obsidian";

const KEY_PREFIX = "pg-conn-";

export class ConnectionSecretStorage {
	private app: App;
	readonly available: boolean;

	constructor(app: App) {
		this.app = app;
		this.available =
			app.secretStorage != null &&
			typeof app.secretStorage.setSecret === "function";
	}

	private key(connectionId: string): string {
		return KEY_PREFIX + connectionId;
	}

	store(connectionId: string, connectionString: string): void {
		if (!this.available) return;
		try {
			this.app.secretStorage.setSecret(
				this.key(connectionId),
				connectionString
			);
		} catch (e) {
			console.error(
				`[postgres-browser] Failed to store secret for ${connectionId}:`,
				e
			);
		}
	}

	retrieve(connectionId: string): string | null {
		if (!this.available) return null;
		try {
			return this.app.secretStorage.getSecret(this.key(connectionId));
		} catch (e) {
			console.error(
				`[postgres-browser] Failed to retrieve secret for ${connectionId}:`,
				e
			);
			return null;
		}
	}

	remove(connectionId: string): void {
		if (!this.available) return;
		try {
			this.app.secretStorage.setSecret(this.key(connectionId), "");
		} catch (e) {
			console.error(
				`[postgres-browser] Failed to remove secret for ${connectionId}:`,
				e
			);
		}
	}
}
