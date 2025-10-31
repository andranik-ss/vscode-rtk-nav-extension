# RTK Query Navigator

A VSCode extension that enables seamless navigation from RTK Query generated hooks to their endpoint definitions using `Opt/Alt + Click`.

## Problem Statement

When using RTK Query in TypeScript/React projects, the standard IDE "Go to Definition" (Opt+Click) on generated hooks like `useGetAlertActivityTrendQuery` typically leads to the type definition rather than the actual endpoint implementation. This extension solves that problem by navigating directly to the endpoint definition.

## Features

- **One-Click Navigation**: `Opt/Alt + Click` on any RTK Query hook to jump directly to its endpoint definition
- **Automatic Detection**: Works with both `Query` and `Mutation` hooks
- **Smart Search**: Searches current file first, then `features/**/api/` folders in workspace
- **Command Palette Fallback**: `Cmd+Shift+P` → "RTK: Go to Endpoint Definition" if Opt+Click doesn't work
- **Error Handling**: Gracefully handles files that can't be read without crashing

## Supported Patterns

The extension recognizes the standard RTK Query naming convention:

- `useGetAlertActivityTrendQuery` → `getAlertActivityTrend`
- `useUpdateAlertsStatusMutation` → `updateAlertsStatus`
- `useGetSingleAlertQuery` → `getSingleAlert`
- Any `use[Name]Query` or `use[Name]Mutation` pattern

## Installation

### Quick Install (Recommended)

Use the provided install script:

```bash
cd vscode-rtk-nav-extension
chmod +x install.sh
./install.sh
```

The script will:
1. Install dependencies (`npm install`)
2. Compile TypeScript (`npm run compile`)
3. Package the extension (`npm run package`)
4. Install it in VSCode/Cursor (if `code` command is available)

### Manual Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Compile the extension:**
```bash
npm run compile
```

3. **Package as VSIX:**
```bash
npm run package
```

4. **Install in VSCode/Cursor:**
   - Press `Cmd+Shift+P`
   - Type: `Extensions: Install from VSIX...`
   - Select: `rtk-query-navigator-0.0.1.vsix`

5. **Reload window:**
   - Press `Cmd+Shift+P` → `Developer: Reload Window`

### Development Mode

For development and testing:

1. Open extension folder in VSCode
2. Press `F5` to launch Extension Development Host
3. Test in the new window
4. Check console output for `[RTK Nav]` logs

## Usage

### Method 1: Opt+Click (Primary)

1. Open any TypeScript/TSX file with RTK Query hooks
2. Place cursor on a hook name (e.g., `useGetAlertActivityTrendQuery`)
3. Hold **Opt** (Mac) or **Alt** (Windows/Linux)
4. Click on the hook name
5. You'll be taken directly to the endpoint definition!

### Method 2: Command Palette (Fallback)

1. Place cursor on any RTK Query hook
2. Press `Cmd+Shift+P`
3. Type: `RTK: Go to Endpoint Definition`
4. Press Enter

## Example

```typescript
// In a component - click on this hook:
const { data } = useGetAlertActivityTrendQuery();
//                ^ Opt+Click here

// Navigates directly to:
const alertsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAlertActivityTrend: builder.query<IActivityTrendItem[], void>({
      //                  ^ Lands here!
      query: () => 'alerts/activity-trend',
    }),
  }),
});
```

## How It Works

1. **Detects** when you Opt+Click on a hook like `useGetAlertActivityTrendQuery`
2. **Converts** the hook name to endpoint name: `getAlertActivityTrend` (removes `use` prefix and `Query/Mutation` suffix)
3. **Searches** for the pattern `getAlertActivityTrend: builder.query` or `builder.mutation`
4. **Navigates** you directly to the endpoint definition

### Search Strategy

1. **Current Document First**: Checks if endpoint exists in the same file
2. **Workspace Search**: Searches `features/**/api/*.{ts,tsx}` files
3. **Exclusions**: Skips `node_modules` and extension directory
4. **Error Handling**: Gracefully handles files that can't be read

## Requirements

- VSCode/Cursor 1.80.0 or higher
- TypeScript/TypeScriptReact files
- Node.js 18+ and npm (for building from source)

## Troubleshooting

### Extension Not Working

**Symptoms:**
- No navigation occurs when clicking on hooks
- No error messages

**Solutions:**
1. Check extension is enabled:
   - Press `Cmd+Shift+X` (Extensions)
   - Search for "RTK Query Navigator"
   - Ensure it's enabled

2. Reload window:
   - Press `Cmd+Shift+P` → `Developer: Reload Window`

3. Check Developer Console:
   - Press `Cmd+Shift+P` → `Developer: Toggle Developer Tools`
   - Look for `[RTK Nav]` log messages
   - Should see: `[RTK Nav] Extension activated!`

### Can't Find Endpoint

**Possible Causes:**
1. Endpoint doesn't follow naming convention
2. File is not in `features/**/api/` folder structure
3. Endpoint uses different pattern than `endpointName: builder.query`

**Debugging:**
- Check Developer Console for `[RTK Nav]` logs
- Should see: `[RTK Nav] Looking for endpoint: <name>`
- Should see: `[RTK Nav] Found in current document:` or `[RTK Nav] Searching workspace...`

## Known Limitations

1. **Naming Convention**: Requires standard RTK Query naming (`use[Name]Query` or `use[Name]Mutation`)
2. **File Structure**: Assumes endpoints are in `features/**/api/` folders
3. **Single Workspace**: Only searches within current workspace
4. **Pattern Matching**: Endpoints must follow `endpointName: builder.query` or `builder.mutation` pattern

## Development

### Building from Source

```bash
cd vscode-rtk-nav-extension
npm install
npm run compile
npm run package
```

### Modifying the Extension

Key files:
- `src/extension.ts` - Main extension logic
- `package.json` - Extension manifest and configuration

To customize:
- Search patterns: Modify regex in `findEndpointDefinition()`
- File locations: Change `features/**/api/` pattern in `searchInWorkspace()`
- Hook patterns: Adjust `hookNameToEndpointName()` function

## Release Notes

### 0.0.1

Initial release with basic navigation support:
- Opt+Click navigation from hooks to endpoints
- Command palette fallback
- Smart search in current file and workspace
- Support for Query and Mutation hooks




