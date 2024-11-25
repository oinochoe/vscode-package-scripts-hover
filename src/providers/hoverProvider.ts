import * as vscode from "vscode";

type ScriptDocs = Record<string, string>;

export class PackageJsonHoverProvider implements vscode.HoverProvider {
  private cachedDocs: ScriptDocs | null = null;

  // Basic
  private readonly defaultDocs: ScriptDocs = {
    dev: "Runs development server (default port: 5173)",
    build: "Creates a production build",
    preview: "Previews the built version locally",
    test: "Runs tests",
    lint: "Runs code linting",
    format: "Formats the codebase",
  };

  public clearCache(): void {
    this.cachedDocs = null;
  }

  public async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    const text = document.getText();
    let packageJson: { scripts?: Record<string, string> };

    try {
      packageJson = JSON.parse(text);
    } catch (e) {
      return null;
    }

    const line = document.lineAt(position.line).text;
    const lineMatch = line.match(/"([^"]+)":/);
    if (!lineMatch) return null;

    const scriptName = lineMatch[1];
    if (!packageJson.scripts?.[scriptName]) return null;

    const docs = await this.loadCustomDocs();
    const command = packageJson.scripts[scriptName];
    const description = docs[scriptName] || "No description available.";

    const content = new vscode.MarkdownString("", true); // HTML 지원 활성화
    content.isTrusted = true; // 신뢰할 수 있는 콘텐츠로 마크
    content.supportHtml = true;

    content.appendMarkdown(`### \`${scriptName}\`\n\n`);
    content.appendMarkdown(`**Description:** ${description}\n\n`);
    content.appendMarkdown(`**Command:** \`${command}\`\n\n`);
    content.appendMarkdown(`Usage: \`npm run ${scriptName}\``);

    return new vscode.Hover(content);
  }

  private async loadCustomDocs(force: boolean = false): Promise<ScriptDocs> {
    if (this.cachedDocs && !force) {
      return this.cachedDocs;
    }

    try {
      // 설정에서 커스텀 문서 경로 가져오기
      const config = vscode.workspace.getConfiguration("packageScriptsHover");
      const customDocsPath =
        config.get<string>("customDocsPath") ?? ".vscode/script-docs.json";

      // 커스텀 문서 파일 찾기
      const files = await vscode.workspace.findFiles(customDocsPath, null, 1);

      if (files.length > 0) {
        const content = await vscode.workspace.fs.readFile(files[0]);
        const customDocs = JSON.parse(content.toString()) as ScriptDocs;

        // 기본 문서와 커스텀 문서 병합
        this.cachedDocs = {
          ...this.defaultDocs,
          ...customDocs,
        };
      } else {
        this.cachedDocs = this.defaultDocs;
      }
    } catch (error) {
      console.error(
        "Error loading custom docs:",
        error instanceof Error ? error.message : error
      );
      this.cachedDocs = this.defaultDocs;
    }

    return this.cachedDocs;
  }
}
