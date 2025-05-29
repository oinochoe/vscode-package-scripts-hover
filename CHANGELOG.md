# Change Log

All notable changes to the "package-scripts-hover" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.1.0] - 2024-05-29

- Add support for nested structures by scanning all package.json files in the workspace and using a nested structure in `.vscode/script-docs.json`.
- Implement automatic conversion of old `.vscode/script-docs.json` format to the new nested structure upon loading.
- Add automatic documentation cache reload when `.vscode/script-docs.json` is changed, created, or deleted (with debounce).
- Update `createDocs` command to scan all package.json files and merge into the central `.vscode/script-docs.json`.

## [0.0.2] - 2024-03-26

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

## [Unreleased]