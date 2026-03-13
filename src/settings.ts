import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type PostgresBrowserPlugin from "./main";
import type { ConnectionConfig } from "./types";
import { MAX_PREVIEW_ROW_LIMIT } from "./constants";

export class PostgresBrowserSettingTab extends PluginSettingTab {
  plugin: PostgresBrowserPlugin;

  constructor(app: App, plugin: PostgresBrowserPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Preview row limit")
      .setDesc(
        `Maximum rows to fetch when previewing table data (max ${MAX_PREVIEW_ROW_LIMIT.toLocaleString()})`,
      )
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.previewRowLimit))
          .onChange(async (value) => {
            const num = parseInt(value, 10);
            if (!isNaN(num) && num > 0 && num <= MAX_PREVIEW_ROW_LIMIT) {
              this.plugin.settings.previewRowLimit = num;
              await this.plugin.saveSettings();
            }
          }),
      );

    new Setting(containerEl)
      .setName("Query timeout (seconds)")
      .setDesc("Maximum time to wait for a query to complete")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.queryTimeoutSeconds))
          .onChange(async (value) => {
            const num = parseInt(value, 10);
            if (!isNaN(num) && num > 0) {
              this.plugin.settings.queryTimeoutSeconds = num;
              await this.plugin.saveSettings();
            }
          }),
      );

    new Setting(containerEl).setName("Database connections").setHeading();

    const notice = containerEl.createEl("p");
    if (this.plugin.secretStorage.available) {
      notice.setText(
        "Connection strings are encrypted using your operating system secure storage (keychain).",
      );
      notice.addClass("pg-notice-secure");
    } else {
      notice.setText(
        "Connection strings are stored in plaintext in your vault's plugin data folder. Upgrade to version 1.11.4+ for operating system keychain encryption.",
      );
      notice.addClass("pg-notice-insecure");
    }

    for (const conn of this.plugin.settings.connections) {
      this.renderConnection(containerEl, conn);
    }

    new Setting(containerEl).addButton((btn) =>
      btn
        .setButtonText("Add connection")
        .setCta()
        .onClick(async () => {
          const newConn: ConnectionConfig = {
            id: crypto.randomUUID(),
            name: "New connection",
            connectionString: "",
          };
          this.plugin.settings.connections.push(newConn);
          await this.plugin.saveSettings();
          this.display();
        }),
    );
  }

  private plaintextWarningShown = false;

  private renderConnection(
    containerEl: HTMLElement,
    conn: ConnectionConfig,
  ): void {
    const section = containerEl.createDiv({ cls: "pg-connection-section" });

    new Setting(section).setName("Connection name").addText((text) =>
      text.setValue(conn.name).onChange(async (value) => {
        conn.name = value;
        await this.plugin.saveSettings();
      }),
    );

    const connStringSetting = new Setting(section)
      .setName("Connection string")
      .setDesc("Enter a connection string.")
      .addText((text) => {
        text.inputEl.type = "password";
        text.inputEl.addClass("pg-conn-string-input");
        text.setValue(conn.connectionString).onChange(async (value) => {
          conn.connectionString = value.trim();
          await this.plugin.saveSettings();
          updateParsedInfo(conn.connectionString);
          if (
            !this.plugin.secretStorage.available &&
            conn.connectionString &&
            !this.plaintextWarningShown
          ) {
            this.plaintextWarningShown = true;
            new Notice(
              "Warning: connection string will be stored in plaintext. Upgrade to version 1.11.4+ for encrypted storage.",
            );
          }
        });
      });

    const parsedInfoEl = connStringSetting.settingEl.createDiv({
      cls: "pg-parsed-info",
    });

    const updateParsedInfo = (raw: string) => {
      parsedInfoEl.empty();
      if (!raw) return;
      try {
        const url = new URL(raw);
        const host = url.hostname || "localhost";
        const port = url.port || "5432";
        const database = url.pathname.replace(/^\//, "") || "";
        const schema = url.searchParams.get("schema") || "";

        let parts = `host=${host} port=${port}`;
        if (database) {
          parts += ` database=${database}`;
        }
        if (schema) {
          parts += ` schema=${schema}`;
        }

        parsedInfoEl.createEl("span", {
          text: `Parsed: ${parts}`,
          cls: "pg-parsed-details",
        });

        if (!database) {
          parsedInfoEl.createEl("span", {
            text: "No database specified \u2014 will default to username as database name.",
            cls: "pg-parsed-warning",
          });
        }
      } catch {
        parsedInfoEl.createEl("span", {
          text: "Invalid connection string format",
          cls: "pg-parsed-warning",
        });
      }
    };

    updateParsedInfo(conn.connectionString);

    new Setting(section)
      .addButton((btn) =>
        btn.setButtonText("Test connection").onClick(async () => {
          if (!conn.connectionString) {
            new Notice("Please enter a connection string first.");
            return;
          }
          try {
            btn.setButtonText("Testing...");
            btn.setDisabled(true);
            await this.plugin.connectionManager.testConnection(conn);
            new Notice(`Connection "${conn.name}" successful!`);
          } catch (err) {
            new Notice(
              `Connection failed: ${err instanceof Error ? err.message : String(err)}`,
            );
          } finally {
            btn.setButtonText("Test connection");
            btn.setDisabled(false);
          }
        }),
      )
      .addButton((btn) =>
        btn
          .setButtonText("Delete")
          .setWarning()
          .onClick(async () => {
            await this.plugin.connectionManager.disconnect(conn.id);
            this.plugin.secretStorage.remove(conn.id);
            this.plugin.settings.connections =
              this.plugin.settings.connections.filter((c) => c.id !== conn.id);
            if (this.plugin.settings.activeConnectionId === conn.id) {
              this.plugin.settings.activeConnectionId = null;
            }
            await this.plugin.saveSettings();
            this.display();
          }),
      );

    section.createEl("hr");
  }
}
