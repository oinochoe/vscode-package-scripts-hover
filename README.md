# Package Scripts Hover

VS Code extension that shows helpful descriptions when hovering over package.json scripts.

## Features

![Demo](./images/example.gif)

- Hover over npm scripts to see descriptions
- Supports custom documentation via `.vscode/script-docs.json`
- Built-in documentation for common scripts
- Easy to customize and extend

## Usage

1. Open a package.json file
2. Hover over any script in the scripts section
3. View the description, command, and usage in the hover popup

## Custom Descriptions

Create `.vscode/script-docs.json` in your project:

```json
{
  "dev": "Starts development server",
  "build": "Creates production build"
}
```

## Requirements

VS Code version 1.77.0 or higher

## Extension Settings

This extension contributes the following settings:

- `packageScriptsHover.enabled`: Enable/disable hover descriptions
- `packageScriptsHover.customDocsPath`: Path to custom documentation file

## Known Issues

Currently none.

Report issues at GitHub Issues

https://github.com/oinochoe/vscode-package-scripts-hover/issues

## Release Notes

### 0.0.2 (2024-03-26)

#### Added

- New commands for extension management:
  - `Enable Package Scripts Hover`: Manually enable hover functionality
  - `Disable Package Scripts Hover`: Manually disable hover functionality
  - `Reload Custom Docs`: Force reload documentation cache
  - `Create Script Documentation Template`: Automatically generate script-docs.json template from package.json
- Automatic script documentation template generation:
  - Creates .vscode directory if needed
  - Generates script-docs.json with default descriptions
  - Asks for confirmation before overwriting existing file
  - Opens generated file for immediate editing

### 0.0.1

Initial release of Package Scripts Hover

## License

[MIT](LICENSE)
