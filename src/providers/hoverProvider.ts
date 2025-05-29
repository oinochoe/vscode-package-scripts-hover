/**
 * VSCode extension to provide hover information for npm scripts in package.json
 * @author yeongmin
 */
import * as vscode from "vscode";
import path from "path";

/**
 * Type definition for script documentation in a nested-like structure
 * Key: package.json relative path (e.g., 'package.json', 'packages/frontend/package.json')
 * Value: Script documentation for that package.json (Record<scriptName, description>)
 */
type ScriptDocs = Record<string, Record<string, string>>;

/**
 * Provides hover functionality for package.json scripts
 * Implements VSCode's HoverProvider interface
 */
export class PackageJsonHoverProvider implements vscode.HoverProvider {
  /** Cached documentation to avoid repeated file system reads */
  private cachedDocs: ScriptDocs | null = null;

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
    // Ensure the document is a package.json file
    if (document.fileName.endsWith("package.json")) {
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
      // Regex to find script names, handling potential commas and surrounding whitespace
      const scriptMatch = line.match(/^\s*"([a-zA-Z0-9_:-]+)"\s*:/);

      if (!scriptMatch || scriptMatch.length < 2) {
        return null; // Return null if not hovering over a script name
      }

      const scriptName = scriptMatch[1];

      // Check if the identified name is actually a script key
      if (!packageJson.scripts?.[scriptName]) {
        return null; // Return null if script doesn't exist in package.json
      }

      // Get the relative path of the current package.json file
      const relativePath = vscode.workspace.asRelativePath(document.uri);

      // Load documentation from the main script-docs.json file
      const scriptDocs = await this.loadCustomDocs();

      // Find the documentation for the current package.json and script
      const packageDocs = scriptDocs?.[relativePath];
      const description =
        packageDocs?.[scriptName] || "No description available.";

      // Get the command for the script from the current document
      const command = packageJson.scripts[scriptName];

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

    return null; // Not a package.json file
  }

  /**
   * Loads custom documentation from .vscode/script-docs.json
   * Automatically converts old single-file structure to nested structure if detected.
   * @param force - If true, bypasses cache and forces a reload
   * @returns A promise that resolves to the documentation, or null if file not found or invalid
   */
  private async loadCustomDocs(
    force: boolean = false
  ): Promise<ScriptDocs | null> {
    // Return cached docs if available and force reload not requested
    if (this.cachedDocs && !force) {
      return this.cachedDocs;
    }

    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return null; // No workspace, cannot load docs
      }

      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      const scriptDocsPath = path.join(
        workspaceRoot,
        ".vscode",
        "script-docs.json"
      );
      const scriptDocsUri = vscode.Uri.file(scriptDocsPath);

      let rawDocs: any;
      try {
        // Read the existing file
        const content = await vscode.workspace.fs.readFile(scriptDocsUri);
        rawDocs = JSON.parse(content.toString());

        // TODO: Consider removing this entire 'looksLikeOldStructure' block
        // in a future release after sufficient time has passed for users
        // to migrate to the new nested script-docs.json format.
        // Check if it looks like the old structure (flat object, no path-like keys)
        const looksLikeOldStructure =
          rawDocs &&
          typeof rawDocs === "object" &&
          !Array.isArray(rawDocs) &&
          Object.keys(rawDocs).length > 0 && // Avoid converting empty object
          !Object.keys(rawDocs).some(
            (key) =>
              key.includes("/") || key.includes("\\") || key === "package.json"
          );

        if (looksLikeOldStructure) {
          vscode.window.showInformationMessage(
            "Detected old script-docs.json structure. Converting to nested format."
          );

          const newStructure: ScriptDocs = {
            "package.json": rawDocs as Record<string, string>,
          };

          // Find other package.json files and add them to the new structure if not present
          const packageJsonFiles = await vscode.workspace.findFiles(
            "**/package.json",
            "**/node_modules/**"
          );
          for (const fileUri of packageJsonFiles) {
            const relativePath = vscode.workspace.asRelativePath(fileUri);
            if (
              relativePath !== "package.json" &&
              !newStructure[relativePath]
            ) {
              newStructure[relativePath] = {}; // Add with empty docs
            }
          }

          // Write the converted structure back to the file
          await vscode.workspace.fs.writeFile(
            scriptDocsUri,
            Buffer.from(JSON.stringify(newStructure, null, 2), "utf-8")
          );
          vscode.window.showInformationMessage(
            "script-docs.json successfully converted to nested format."
          );
          rawDocs = newStructure; // Use the new structure going forward
        } else if (
          rawDocs &&
          typeof rawDocs === "object" &&
          !Array.isArray(rawDocs)
        ) {
          // Assume it's the new structure or an empty/valid object
          // Do nothing, use rawDocs as is
        } else {
          // Handle cases where the file content is not a valid object (e.g., array, string, null)
          throw new Error("script-docs.json has an invalid format.");
        }
      } catch (readFileError) {
        // Handle file not found specifically
        if (
          readFileError instanceof vscode.FileSystemError &&
          readFileError.code === "FileNotFound"
        ) {
          console.log("script-docs.json not found.");
          this.cachedDocs = null; // Ensure cache is null if file doesn't exist
          return null; // File not found
        } else {
          // Handle parsing or other read errors
          console.error(
            "Error reading or parsing script-docs.json:",
            readFileError instanceof Error
              ? readFileError.message
              : readFileError
          );
          vscode.window.showErrorMessage(
            "Failed to read script-docs.json. Please check file format."
          );
          this.cachedDocs = null; // Clear cache on error
          return null; // Error reading/parsing
        }
      }

      // If we reached here, rawDocs holds the valid (potentially converted) data
      this.cachedDocs = rawDocs as ScriptDocs;
      return this.cachedDocs;
    } catch (error) {
      // Catch any unexpected errors during the process
      console.error(
        "Unexpected error in loadCustomDocs:",
        error instanceof Error ? error.message : error
      );
      this.cachedDocs = null;
      return null;
    }
  }
}
