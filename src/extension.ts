import * as vscode from "vscode";
import { PackageJsonHoverProvider } from "./providers/hoverProvider";
import * as path from "path";

let hoverProvider: vscode.Disposable | undefined;

/**
 * Creates script-docs.json template by analyzing the current package.json
 * This will generate a template with descriptions for all npm scripts
 *
 * Process:
 * 1. Find workspace and package.json
 * 2. Create .vscode directory if it doesn't exist
 * 3. Generate script-docs.json with template descriptions
 * 4. Open the file for editing
 */
async function createScriptDocs() {
  try {
    // Check for workspace
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      throw new Error("No workspace folder found");
    }

    // Look for package.json in the workspace
    const packageJsonFiles = await vscode.workspace.findFiles(
      "**/package.json",
      "**/node_modules/**"
    );
    if (packageJsonFiles.length === 0) {
      throw new Error("No package.json found in workspace");
    }

    // Read and parse package.json
    const packageJsonContent = await vscode.workspace.fs.readFile(
      packageJsonFiles[0]
    );
    const packageJson = JSON.parse(packageJsonContent.toString());

    if (!packageJson.scripts) {
      throw new Error("No scripts found in package.json");
    }

    // Create .vscode directory if it doesn't exist
    const vscodePath = path.join(workspaceFolders[0].uri.fsPath, ".vscode");
    try {
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(vscodePath));
    } catch (error) {
      // Ignore if directory already exists
    }

    // Set up path for script-docs.json
    const scriptDocsPath = path.join(vscodePath, "script-docs.json");
    const scriptDocsUri = vscode.Uri.file(scriptDocsPath);

    // Check if script-docs.json already exists
    try {
      await vscode.workspace.fs.stat(scriptDocsUri);
      // Ask for confirmation before overwriting
      const answer = await vscode.window.showWarningMessage(
        "script-docs.json already exists. Do you want to overwrite it?",
        "Yes",
        "No"
      );
      if (answer !== "Yes") {
        return;
      }
    } catch (error) {
      // File doesn't exist, proceed with creation
    }

    // Generate template content for each script
    const template: Record<string, string> = {};
    Object.keys(packageJson.scripts).forEach((scriptName) => {
      template[
        scriptName
      ] = `Description for '${scriptName}' script: ${packageJson.scripts[scriptName]}`;
    });

    // Write the template to script-docs.json
    await vscode.workspace.fs.writeFile(
      scriptDocsUri,
      Buffer.from(JSON.stringify(template, null, 2), "utf-8")
    );

    // Open the newly created file for editing
    const document = await vscode.workspace.openTextDocument(scriptDocsUri);
    await vscode.window.showTextDocument(document);

    vscode.window.showInformationMessage(
      "script-docs.json has been created successfully!"
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to create script-docs.json: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Activates the extension
 * Sets up hover provider and registers all commands
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('Extension "package-scripts-hover" is now active');

  const provider = new PackageJsonHoverProvider();

  // Register enable command
  const enableCommand = vscode.commands.registerCommand(
    "package-scripts-hover.enable",
    () => {
      if (!hoverProvider) {
        hoverProvider = vscode.languages.registerHoverProvider(
          { pattern: "**/package.json" },
          provider
        );
        context.subscriptions.push(hoverProvider);
        vscode.window.showInformationMessage(
          "Package Scripts Hover is now enabled"
        );
      } else {
        vscode.window.showInformationMessage(
          "Package Scripts Hover is already enabled"
        );
      }
    }
  );

  // Register disable command
  const disableCommand = vscode.commands.registerCommand(
    "package-scripts-hover.disable",
    () => {
      if (hoverProvider) {
        hoverProvider.dispose();
        hoverProvider = undefined;
        vscode.window.showInformationMessage(
          "Package Scripts Hover is now disabled"
        );
      } else {
        vscode.window.showInformationMessage(
          "Package Scripts Hover is already disabled"
        );
      }
    }
  );

  // Register reload command
  const reloadCommand = vscode.commands.registerCommand(
    "package-scripts-hover.reload",
    () => {
      provider.clearCache();
      vscode.window.showInformationMessage(
        "Package Scripts documentation has been reloaded"
      );
    }
  );

  // Register create docs command
  const createDocsCommand = vscode.commands.registerCommand(
    "package-scripts-hover.createDocs",
    createScriptDocs
  );

  // Register default hover provider
  hoverProvider = vscode.languages.registerHoverProvider(
    { pattern: "**/package.json" },
    provider
  );

  // Add all commands and the hover provider to subscriptions
  context.subscriptions.push(
    enableCommand,
    disableCommand,
    reloadCommand,
    createDocsCommand,
    hoverProvider
  );
}

/**
 * Deactivates the extension
 * Cleans up the hover provider
 */
export function deactivate() {
  if (hoverProvider) {
    hoverProvider.dispose();
    hoverProvider = undefined;
  }
}
