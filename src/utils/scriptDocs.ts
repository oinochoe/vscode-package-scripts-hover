import * as path from "path";
import * as fs from "fs";
import * as vscode from "vscode";

interface ScriptDocs {
  [key: string]: string;
}

const defaultDocs: ScriptDocs = {
  dev: "Runs development server (default port: 5173)",
  build: "Creates a production build",
  preview: "Previews the built version locally",
  test: "Runs tests",
  lint: "Runs code linting",
  format: "Formats code using prettier",
};

export function getScriptDocs(): ScriptDocs {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  if (!workspaceRoot) return defaultDocs;

  const customDocsPath = path.join(
    workspaceRoot,
    ".vscode",
    "script-docs.json"
  );

  try {
    if (fs.existsSync(customDocsPath)) {
      const customDocs = JSON.parse(fs.readFileSync(customDocsPath, "utf8"));
      return { ...defaultDocs, ...customDocs };
    }
  } catch (error) {
    console.error("Error loading custom docs:", error);
  }

  return defaultDocs;
}
