import * as vscode from 'vscode';

// Output channel for logging
let outputChannel: vscode.OutputChannel;

/**
 * Converts RTK Query hook name to endpoint name
 * Examples:
 * - useGetAlertActivityTrendQuery -> getAlertActivityTrend
 * - useGetAlertActivityTrendLazyQuery -> getAlertActivityTrend
 * - useUpdateAlertsStatusMutation -> updateAlertsStatus
 */
function hookNameToEndpointName(hookName: string): string | null {
  // Match pattern: use[EndpointName](Query|LazyQuery|Mutation)
  const match = hookName.match(/^use(.+?)(Query|LazyQuery|Mutation)$/);
  if (!match) {
    return null;
  }
  
  const endpointName = match[1];
  // Convert first letter to lowercase
  return endpointName.charAt(0).toLowerCase() + endpointName.slice(1);
}

/**
 * Find the endpoints block in the document
 */
function findEndpointsBlock(text: string): { start: number; end: number } | null {
  // Look for: endpoints: (build) => ({ or endpoints: (builder) => ({
  const endpointsPattern = /endpoints:\s*\([^)]*\)\s*=>\s*\(/g;
  const match = endpointsPattern.exec(text);
  
  if (!match) {
    return null;
  }
  
  const startIndex = match.index;
  
  // Find the matching closing brace by counting braces
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let endIndex = startIndex + match[0].length;
  
  for (let i = endIndex; i < text.length; i++) {
    const char = text[i];
    const prevChar = i > 0 ? text[i - 1] : '';
    
    // Handle strings to avoid counting braces inside them
    if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }
    
    if (!inString) {
      if (char === '{' || char === '(') {
        depth++;
      } else if (char === '}' || char === ')') {
        depth--;
        if (depth < 0) {
          endIndex = i;
          break;
        }
      }
    }
  }
  
  return { start: startIndex, end: endIndex };
}

/**
 * Find endpoint definition in the document
 */
async function findEndpointDefinition(
  document: vscode.TextDocument,
  endpointName: string
): Promise<vscode.Location | null> {
  const text = document.getText();
  
  // First, try to find the endpoints block
  const endpointsBlock = findEndpointsBlock(text);
  const searchText = endpointsBlock 
    ? text.substring(endpointsBlock.start, endpointsBlock.end)
    : text;
  const offset = endpointsBlock ? endpointsBlock.start : 0;
  
  // Look for pattern: endpointName: build.query or builder.query
  // Handle various formats:
  // - getAlertActivityTrend: build.query<
  // - getAlertActivityTrend: builder.query<
  // - getAlertActivityTrend: build.mutation({
  // - "getAlertActivityTrend": build.query
  // - 'getAlertActivityTrend': builder.query
  const patterns = [
    // Standard format: endpointName: build.query/mutation OR builder.query/mutation
    new RegExp(`\\b${endpointName}\\s*:\\s*build(?:er)?\\.(query|mutation)`, 'g'),
    // Quoted format: "endpointName": build.query/mutation
    new RegExp(`['"]${endpointName}['"]\\s*:\\s*build(?:er)?\\.(query|mutation)`, 'g'),
    // With optional whitespace
    new RegExp(`\\b${endpointName}\\s*:\\s*build(?:er)?\\s*\\.\\s*(query|mutation)`, 'g'),
  ];
  
  for (const pattern of patterns) {
    const match = pattern.exec(searchText);
    if (match) {
      const position = document.positionAt(offset + match.index);
      return new vscode.Location(document.uri, position);
    }
  }
  
  return null;
}

/**
 * Search for endpoint definition in workspace using text search
 */
async function searchInWorkspace(endpointName: string): Promise<vscode.Location | null> {
  const log = (msg: string) => {
    console.log(msg);
    outputChannel.appendLine(msg);
  };
  
  log(`[Search] Looking for endpoint: ${endpointName}`);
  const startTime = Date.now();
  
  try {
    // Get search patterns from configuration
    const config = vscode.workspace.getConfiguration('rtkQueryNavigator');
    const searchPatterns: string[] = config.get('searchPatterns') || [
      '**/features/**/api/*.{ts,tsx}',
      '**/api/**/*.{ts,tsx}',
      '**/services/**/*.{ts,tsx}',
      '**/*api*.{ts,tsx}',
    ];
    
    const excludePattern = '{**/node_modules/**,**/out/**,**/dist/**,**/build/**}';
    
    for (const pattern of searchPatterns) {
      log(`[Search] Pattern: ${pattern}`);
      const files = await vscode.workspace.findFiles(pattern, excludePattern, 100);
      
      log(`[Search] Found ${files.length} files`);
      
      if (files.length === 0) {
        continue; // Skip to next pattern
      }
      
      // Check files in parallel for speed
      const results = await Promise.all(
        files.map(async (file) => {
          try {
            const doc = await vscode.workspace.openTextDocument(file);
            return { file, doc, location: await findEndpointDefinition(doc, endpointName) };
          } catch (error) {
            return { file, doc: null, location: null };
          }
        })
      );
      
      // Find first match
      const match = results.find(r => r.location !== null);
      if (match && match.location) {
        const elapsed = Date.now() - startTime;
        log(`[Search] ✓ Found in ${elapsed}ms: ${vscode.workspace.asRelativePath(match.file)}`);
        return match.location;
      }
    }
    
    const elapsed = Date.now() - startTime;
    log(`[Search] ✗ Not found after ${elapsed}ms`);
    return null;
  } catch (error) {
    log(`[Search] Error: ${error}`);
    return null;
  }
}

/**
 * Custom Definition Provider for RTK Query hooks
 */
class RTKQueryDefinitionProvider implements vscode.DefinitionProvider {
  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Definition | null> {
    const startTime = Date.now();
    
    try {
      // Get the word at the current position
      const wordRange = document.getWordRangeAtPosition(position, /\b\w+\b/);
      if (!wordRange) {
        return null;
      }
      
      const word = document.getText(wordRange);
      
      // Check if it's an RTK Query hook
      if (!word.startsWith('use') || 
          (!word.endsWith('Query') && !word.endsWith('LazyQuery') && !word.endsWith('Mutation'))) {
        return null;
      }
      
      // Convert hook name to endpoint name
      const endpointName = hookNameToEndpointName(word);
      if (!endpointName) {
        return null;
      }
      
      outputChannel.appendLine(`\n[Navigate] Hook: ${word} → Endpoint: ${endpointName}`);
      
      // First, try to find in the current document (fast)
      const currentDocLocation = await findEndpointDefinition(document, endpointName);
      if (currentDocLocation) {
        const elapsed = Date.now() - startTime;
        outputChannel.appendLine(`[Navigate] ✓ Found in current document (${elapsed}ms)`);
        return currentDocLocation;
      }
      
      // Check if request was cancelled
      if (token.isCancellationRequested) {
        outputChannel.appendLine('[Navigate] Request cancelled');
        return null;
      }
      
      // If not found in current document, search in workspace with timeout
      outputChannel.appendLine('[Navigate] Not in current document, searching workspace...');
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => {
          outputChannel.appendLine('[Navigate] Search timeout (2s)');
          resolve(null);
        }, 2000); // 2 second timeout
      });
      
      const workspaceLocation = await Promise.race([
        searchInWorkspace(endpointName),
        timeoutPromise
      ]);
      
      if (workspaceLocation) {
        const elapsed = Date.now() - startTime;
        outputChannel.appendLine(`[Navigate] ✓ Total time: ${elapsed}ms`);
        return workspaceLocation;
      }
      
      const elapsed = Date.now() - startTime;
      outputChannel.appendLine(`[Navigate] ✗ Endpoint not found (${elapsed}ms)`);
      return null;
    } catch (error) {
      outputChannel.appendLine(`[Navigate] Error: ${error}`);
      return null;
    }
  }
}

/**
 * Command to manually navigate to endpoint definition
 */
async function navigateToEndpoint() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor');
    return;
  }
  
  const position = editor.selection.active;
  const wordRange = editor.document.getWordRangeAtPosition(position, /\b\w+\b/);
  
  if (!wordRange) {
    vscode.window.showErrorMessage('No word found at cursor');
    return;
  }
  
  const word = editor.document.getText(wordRange);
  
  if (!word.startsWith('use') || 
      (!word.endsWith('Query') && !word.endsWith('LazyQuery') && !word.endsWith('Mutation'))) {
    vscode.window.showErrorMessage('Not an RTK Query hook');
    return;
  }
  
  const endpointName = hookNameToEndpointName(word);
  if (!endpointName) {
    vscode.window.showErrorMessage('Could not parse hook name');
    return;
  }
  
  vscode.window.showInformationMessage(`Searching for endpoint: ${endpointName}...`);
  
  // Try current document first
  let location = await findEndpointDefinition(editor.document, endpointName);
  
  // Then try workspace
  if (!location) {
    location = await searchInWorkspace(endpointName);
  }
  
  if (location) {
    await vscode.window.showTextDocument(location.uri, {
      selection: new vscode.Range(location.range.start, location.range.start)
    });
    vscode.window.showInformationMessage(`Found: ${endpointName}`);
  } else {
    vscode.window.showErrorMessage(`Endpoint not found: ${endpointName}`);
  }
}

/**
 * Diagnostic command to find API files in workspace
 */
async function findApiFiles() {
  outputChannel.clear();
  outputChannel.show();
  outputChannel.appendLine('=== RTK Query Navigator - API Files Diagnostic ===\n');
  
  const config = vscode.workspace.getConfiguration('rtkQueryNavigator');
  const searchPatterns: string[] = config.get('searchPatterns') || [
    '**/features/**/api/*.{ts,tsx}',
    '**/api/**/*.{ts,tsx}',
    '**/services/**/*.{ts,tsx}',
    '**/*api*.{ts,tsx}',
  ];
  
  outputChannel.appendLine('Search Patterns:');
  searchPatterns.forEach(pattern => outputChannel.appendLine(`  - ${pattern}`));
  outputChannel.appendLine('');
  
  const excludePattern = '{**/node_modules/**,**/out/**,**/dist/**,**/build/**}';
  let totalFiles = 0;
  
  for (const pattern of searchPatterns) {
    outputChannel.appendLine(`Searching: ${pattern}`);
    const files = await vscode.workspace.findFiles(pattern, excludePattern, 200);
    
    if (files.length > 0) {
      outputChannel.appendLine(`  ✓ Found ${files.length} files:`);
      files.slice(0, 10).forEach(file => {
        outputChannel.appendLine(`    - ${vscode.workspace.asRelativePath(file)}`);
      });
      if (files.length > 10) {
        outputChannel.appendLine(`    ... and ${files.length - 10} more files`);
      }
      totalFiles += files.length;
    } else {
      outputChannel.appendLine(`  ✗ No files found`);
    }
    outputChannel.appendLine('');
  }
  
  outputChannel.appendLine('======================');
  outputChannel.appendLine(`Total API files found: ${totalFiles}`);
  outputChannel.appendLine('======================');
  
  vscode.window.showInformationMessage(
    `Found ${totalFiles} API files. Check Output panel for details.`
  );
}

export function activate(context: vscode.ExtensionContext) {
  console.log('[RTK Nav] Extension activating...');
  
  try {
    // Create output channel for logging
    outputChannel = vscode.window.createOutputChannel('RTK Query Navigator');
    context.subscriptions.push(outputChannel);
    
    outputChannel.appendLine('RTK Query Navigator activated');
    
    // Register the definition provider for TypeScript and TSX files
    const definitionProvider = vscode.languages.registerDefinitionProvider(
      [
        { language: 'typescript', scheme: 'file' },
        { language: 'typescriptreact', scheme: 'file' }
      ],
      new RTKQueryDefinitionProvider()
    );
    
    // Register command for manual navigation
    const navigateCommand = vscode.commands.registerCommand(
      'rtk-query-navigator.goToEndpoint',
      navigateToEndpoint
    );
    
    // Register diagnostic command
    const diagnosticCommand = vscode.commands.registerCommand(
      'rtk-query-navigator.findApiFiles',
      findApiFiles
    );
    
    context.subscriptions.push(definitionProvider, navigateCommand, diagnosticCommand);
    
    console.log('[RTK Nav] Extension activated successfully!');
    console.log('[RTK Nav] Definition provider registered for typescript and typescriptreact');
    console.log('[RTK Nav] Commands registered');
    
    // Show activation message
    vscode.window.showInformationMessage(
      'RTK Query Navigator activated! Use Opt+Click or Cmd+Shift+P → "RTK: Go to Endpoint"'
    );
  } catch (error) {
    console.error('[RTK Nav] Error during activation:', error);
    vscode.window.showErrorMessage(`RTK Query Navigator activation failed: ${error}`);
  }
}

export function deactivate() {
  console.log('[RTK Nav] Extension deactivated');
}


