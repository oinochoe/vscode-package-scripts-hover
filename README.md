# Package Scripts Hover

VS Code extension that shows helpful descriptions when hovering over package.json scripts.

## Features

- Shows descriptions when hovering over scripts in package.json
- Add custom descriptions via `.vscode/script-docs.json`
- Displays script commands and usage instructions

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

VS Code version 1.60.0 or higher

## Extension Settings

packageScriptsHover.enableCustomDocs: Enable/disable loading custom documentation from .vscode/script-docs.json

## Known Issues

Report issues at GitHub Issues

## Release Notes

0.0.1

## Initial release of Package Scripts Hover

Basic hover functionality
Custom documentation support
