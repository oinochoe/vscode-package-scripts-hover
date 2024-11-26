/**
 * VSCode extension to provide hover information for npm scripts in package.json
 * @author yeongmin
 */
import * as vscode from "vscode";

/**
 * Type definition for script documentation key-value pairs
 * Key: script name (e.g., 'build', 'test')
 * Value: description of what the script does
 */
type ScriptDocs = Record<string, string>;

/**
 * Provides hover functionality for package.json scripts
 * Implements VSCode's HoverProvider interface
 */
export class PackageJsonHoverProvider implements vscode.HoverProvider {
  /** Cached documentation to avoid repeated file system reads */
  private cachedDocs: ScriptDocs | null = null;

  /**
   * Default documentation for common npm scripts
   * These will be used if no custom documentation is provided
   * Can be overridden by custom docs in .vscode/script-docs.json
   */
  private readonly defaultDocs: ScriptDocs = {
    dev: "Runs development server (default port: 5173)",
    build: "Creates a production build",
    preview: "Previews the built version locally",
    test: "Runs tests",
    lint: "Runs code linting",
    format: "Formats the codebase",
  };

  /**
   * Clears the cached documentation
   * Useful when custom documentation has been updated
   */
  public clearCache(): void {
    this.cachedDocs = null;
  }

  /**
   * Provides hover information for package.json scripts
   * @param document - The current text document
   * @param position - The position of the hover
   * @param token - A cancellation token
   * @returns A hover containing script information, or null if not hovering over a script
   */
  public async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    // Parse the entire document as JSON
    const text = document.getText();
    let packageJson: { scripts?: Record<string, string> };

    try {
      packageJson = JSON.parse(text);
    } catch (e) {
      return null; // Return null if JSON is invalid
    }

    // Extract the script name from the current line
    const line = document.lineAt(position.line).text;
    const lineMatch = line.match(/"([^"]+)":/);
    if (!lineMatch) {
      return null; // Return null if not hovering over a script name
    }

    const scriptName = lineMatch[1];
    if (!packageJson.scripts?.[scriptName]) {
      return null; // Return null if script doesn't exist in package.json
    }

    // Load documentation and prepare hover content
    const docs = await this.loadCustomDocs();
    const command = packageJson.scripts[scriptName];
    const description = docs[scriptName] || "No description available.";

    // Create rich markdown content for the hover
    const content = new vscode.MarkdownString("", true);
    content.isTrusted = true; // Enable trusted content (required for some markdown features)
    content.supportHtml = true; // Enable HTML support in the hover

    // Build the hover content with markdown formatting
    content.appendMarkdown(`### \`${scriptName}\`\n\n`);
    content.appendMarkdown(`**Description:** ${description}\n\n`);
    content.appendMarkdown(`**Command:** \`${command}\`\n\n`);
    content.appendMarkdown(`Usage: \`npm run ${scriptName}\``);

    return new vscode.Hover(content);
  }

  /**
   * Loads custom documentation from the workspace
   * @param force - If true, bypasses cache and forces a reload
   * @returns A promise that resolves to the merged documentation (custom + default)
   */
  private async loadCustomDocs(force: boolean = false): Promise<ScriptDocs> {
    // Return cached docs if available and force reload not requested
    if (this.cachedDocs && !force) {
      return this.cachedDocs;
    }

    try {
      // Get custom docs path from extension settings
      const config = vscode.workspace.getConfiguration("packageScriptsHover");
      const customDocsPath =
        config.get<string>("customDocsPath") ?? ".vscode/script-docs.json";

      // Search for custom documentation file
      const files = await vscode.workspace.findFiles(customDocsPath, null, 1);

      if (files.length > 0) {
        // Read and parse custom documentation
        const content = await vscode.workspace.fs.readFile(files[0]);
        const customDocs = JSON.parse(content.toString()) as ScriptDocs;

        // Merge custom docs with default docs (custom takes precedence)
        this.cachedDocs = {
          ...this.defaultDocs,
          ...customDocs,
        };
      } else {
        // Use default docs if no custom docs found
        this.cachedDocs = this.defaultDocs;
      }
    } catch (error) {
      // Log error and fallback to default docs
      console.error(
        "Error loading custom docs:",
        error instanceof Error ? error.message : error
      );
      this.cachedDocs = this.defaultDocs;
    }

    return this.cachedDocs;
  }
}
