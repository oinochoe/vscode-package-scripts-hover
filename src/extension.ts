import * as vscode from "vscode";
import { PackageJsonHoverProvider } from "./providers/hoverProvider";
import * as path from "path";

let hoverProvider: vscode.Disposable | undefined;

// File system watcher for script-docs.json
let scriptDocsWatcher: vscode.FileSystemWatcher | undefined;

// Debounce function implementation
function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function (...args: Parameters<T>): void {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

// Debounced function to clear the provider's cache
let debouncedClearCache:
  | ((provider: PackageJsonHoverProvider) => void)
  | undefined;

/**
 * Analyzes package.json files in the workspace and updates the .vscode/script-docs.json file.
 * This function will read the existing script-docs.json, merge new script findings,
 * and write the updated content back.
 */
async function updateScriptDocsForWorkspace() {
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error("No workspace folder found");
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const vscodePath = path.join(workspaceRoot, ".vscode");
    const scriptDocsPath = path.join(vscodePath, "script-docs.json");
    const scriptDocsUri = vscode.Uri.file(scriptDocsPath);

    // Create .vscode directory if it doesn't exist
    try {
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(vscodePath));
    } catch (error) {
      // Ignore if directory already exists
    }

    let existingDocs: Record<string, Record<string, string>> = {};
    let fileExists = false;

    // Read existing script-docs.json if it exists
    try {
      const content = await vscode.workspace.fs.readFile(scriptDocsUri);
      existingDocs = JSON.parse(content.toString());
      fileExists = true;
      vscode.window.showInformationMessage(
        "Existing script-docs.json found. Merging new scripts."
      );
    } catch (error) {
      // File not found is expected for the first run
      if (
        error instanceof vscode.FileSystemError &&
        error.code === "FileNotFound"
      ) {
        vscode.window.showInformationMessage(
          "script-docs.json not found. Creating a new one."
        );
      } else {
        console.error("Error reading existing script-docs.json:", error);
        vscode.window.showErrorMessage(
          "Failed to read existing script-docs.json."
        );
        // Proceed with empty existingDocs
      }
    }

    // Find all package.json files excluding node_modules
    const packageJsonFiles = await vscode.workspace.findFiles(
      "**/package.json",
      "**/node_modules/**"
    );

    if (packageJsonFiles.length === 0) {
      if (!fileExists) {
        throw new Error(
          "No package.json files found in workspace and no existing script-docs.json."
        );
      } else {
        vscode.window.showInformationMessage(
          "No package.json files found in workspace, but existing script-docs.json will be kept."
        );
        // If no package.json found but file exists, keep existingDocs
        await vscode.workspace.fs.writeFile(
          scriptDocsUri,
          Buffer.from(JSON.stringify(existingDocs, null, 2), "utf-8")
        );
        const document = await vscode.workspace.openTextDocument(scriptDocsUri);
        await vscode.window.showTextDocument(document);
        return;
      }
    }

    const newDocs: Record<string, Record<string, string>> = {};

    for (const fileUri of packageJsonFiles) {
      try {
        const packageJsonContent = await vscode.workspace.fs.readFile(fileUri);
        const packageJson = JSON.parse(packageJsonContent.toString());
        const relativePath = vscode.workspace.asRelativePath(fileUri);

        newDocs[relativePath] = newDocs[relativePath] || {}; // Initialize if not exists

        if (packageJson.scripts) {
          Object.keys(packageJson.scripts).forEach((scriptName) => {
            // Preserve existing description if available, otherwise use a template
            const existingDescription =
              existingDocs[relativePath]?.[scriptName];
            newDocs[relativePath][scriptName] =
              existingDescription ||
              `Description for '${scriptName}' script in ${relativePath}: ${packageJson.scripts[scriptName]}`;
          });
        } else {
          // If a package.json had scripts before but now doesn't, we keep its existing docs
          if (existingDocs[relativePath]) {
            newDocs[relativePath] = existingDocs[relativePath];
          } else {
            newDocs[relativePath] = {}; // Include if it's a new package.json without scripts
          }
        }
      } catch (readError) {
        console.error(
          `Failed to read or parse ${fileUri.fsPath}: ${readError}`
        );
        // Include an entry indicating failure, preserving existing docs if any
        if (existingDocs[vscode.workspace.asRelativePath(fileUri)]) {
          newDocs[vscode.workspace.asRelativePath(fileUri)] =
            existingDocs[vscode.workspace.asRelativePath(fileUri)];
        } else {
          newDocs[vscode.workspace.asRelativePath(fileUri)] = {
            __error__: `Failed to process: ${
              readError instanceof Error ? readError.message : String(readError)
            }`,
          };
        }
      }
    }

    // Merge any packages from existingDocs that were not found in the current scan
    for (const existingPath in existingDocs) {
      if (!newDocs[existingPath]) {
        newDocs[existingPath] = existingDocs[existingPath];
      }
    }

    await vscode.workspace.fs.writeFile(
      scriptDocsUri,
      Buffer.from(JSON.stringify(newDocs, null, 2), "utf-8")
    );

    const document = await vscode.workspace.openTextDocument(scriptDocsUri);
    await vscode.window.showTextDocument(document);

    vscode.window.showInformationMessage(
      "script-docs.json has been updated successfully!"
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to update script-docs.json: ${
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

  // Initialize debounced clear cache function
  debouncedClearCache = debounce((p: PackageJsonHoverProvider) => {
    console.log("script-docs.json changed, reloading documentation cache.");
    p.clearCache();
    vscode.window.showInformationMessage(
      "Package Scripts documentation cache reloaded."
    );
  }, 500); // 500ms debounce time

  // Create a file system watcher for script-docs.json
  // The pattern matches .vscode/script-docs.json anywhere in the workspace
  scriptDocsWatcher = vscode.workspace.createFileSystemWatcher(
    "**/.vscode/script-docs.json",
    false, // ignoreCreateEvents
    false, // ignoreChangeEvents - we want changes
    false // ignoreDeleteEvents - we want deletions
  );

  // Register event listeners for the watcher
  scriptDocsWatcher.onDidChange((uri) => {
    // When the file changes, clear the cache after debounce time
    if (debouncedClearCache) {
      debouncedClearCache(provider);
    }
  });

  scriptDocsWatcher.onDidCreate((uri) => {
    // When the file is created, clear the cache immediately (or after short debounce)
    if (debouncedClearCache) {
      // Use a shorter debounce or no debounce for creation if preferred
      debouncedClearCache(provider);
    }
  });

  scriptDocsWatcher.onDidDelete((uri) => {
    // When the file is deleted, clear the cache immediately
    if (debouncedClearCache) {
      debouncedClearCache(provider);
    }
  });

  // Add the watcher to the extension's subscriptions so it's disposed on deactivate
  context.subscriptions.push(scriptDocsWatcher);

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
    updateScriptDocsForWorkspace
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
 * Cleans up resources
 */
export function deactivate() {
  if (hoverProvider) {
    hoverProvider.dispose();
    hoverProvider = undefined;
  }
  if (scriptDocsWatcher) {
    scriptDocsWatcher.dispose();
    scriptDocsWatcher = undefined;
  }
  // Clear debounced function reference
  debouncedClearCache = undefined;
}
