import * as vscode from "vscode";
import { resolveUri } from "../utilities";

export interface FileChangeProposal {
  filePath: string;
  originalContent: string;
  proposedContent: string;
  description?: string;
  editorUri?: vscode.Uri;
  changedLines?: { start: number; end: number }[];
}

export interface CodeLensData {
  proposalId: string;
  lineNumber: number;
  action: "accept" | "reject";
}

export class ProposalManager {
    // Event emitter for CodeLens refresh
  public onDidChangeCodeLensesEmitter = new vscode.EventEmitter<void>();
  private proposals: Map<string, FileChangeProposal> = new Map();
  private proposalCounter: number = 0;
  private editorToProposalId: Map<string, string> = new Map();
  public onProposalCreated = new vscode.EventEmitter<string>();
  public onProposalClosed = new vscode.EventEmitter<string>();

  async proposeFileChange(proposal: FileChangeProposal): Promise<string> {
    const proposalId = `proposal_${this.proposalCounter++}`;

    // Calculate changed lines
    const changedLines = this.calculateDiff(proposal.originalContent, proposal.proposedContent);
    proposal.changedLines = changedLines;

    // Create a virtual URI for the editor
    const editorUri = vscode.Uri.parse(`file-proposal://${proposalId}/${proposal.filePath}`);
    proposal.editorUri = editorUri;

    // Register proposal BEFORE opening document
    this.proposals.set(proposalId, proposal);
    this.editorToProposalId.set(editorUri.toString(), proposalId);

    try {
      // Open the proposed content in an editor
      const document = await vscode.workspace.openTextDocument(editorUri);
      const editor = await vscode.window.showTextDocument(document, {
        preview: true,
        viewColumn: vscode.ViewColumn.Active,
      });

      // Highlight changed lines
      this.highlightChangedLines(editor, changedLines);

      this.onProposalCreated.fire(proposalId);
      return proposalId;
    } catch (error) {
      // Clean up on error
      this.proposals.delete(proposalId);
      this.editorToProposalId.delete(editorUri.toString());
      vscode.window.showErrorMessage(`Failed to open proposal editor: ${error instanceof Error ? error.message : "Unknown error"}`);
      throw error;
    }
  }

  getProposal(proposalId: string): FileChangeProposal | undefined {
    return this.proposals.get(proposalId);
  }

  getAllProposalIds(): string[] {
    return Array.from(this.proposals.keys());
  }

  getProposalByEditorUri(uri: vscode.Uri): FileChangeProposal | undefined {
    const proposalId = this.editorToProposalId.get(uri.toString());
    if (!proposalId) return undefined;
    return this.proposals.get(proposalId);
  }

  getProposalIdByEditorUri(uri: vscode.Uri): string | undefined {
    return this.editorToProposalId.get(uri.toString());
  }

  deleteProposal(proposalId: string): void {
    const proposal = this.proposals.get(proposalId);
    if (proposal?.editorUri) {
      this.editorToProposalId.delete(proposal.editorUri.toString());
    }
    this.proposals.delete(proposalId);
    this.onProposalClosed.fire(proposalId);
  }

  async acceptProposal(proposalId: string, range?: { start: number; end: number }): Promise<string> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    // Accept a single change if range is provided
    if (range && proposal.changedLines) {
      const proposalIndex = proposal.changedLines.findIndex(c => c.start === range.start && c.end === range.end);
      if (proposalIndex === -1) {
        throw new Error(`Change range not found in proposal`);
      }
      return await this.acceptSingleChange(proposalId, proposalIndex);
    }
    // Otherwise, accept all changes
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders?.length) {
      throw new Error("No workspace folder is open");
    }
    const fileUri = resolveUri(proposal.filePath, workspaceFolders);
    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(proposal.proposedContent);
    await vscode.workspace.fs.writeFile(fileUri, uint8Array);
    if (proposal.editorUri) {
      const tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
      for (const tab of tabs) {
        if (tab.input instanceof vscode.TabInputText && tab.input.uri.toString() === proposal.editorUri.toString()) {
          await vscode.window.tabGroups.close(tab);
        }
      }
    }
    this.deleteProposal(proposalId);
    return `Successfully applied all changes to ${proposal.filePath}`;
  }

  async rejectProposal(proposalId: string, range?: { start: number; end: number }): Promise<string> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }
    // Reject a single change if range is provided
    if (range && proposal.changedLines) {
      const proposalIndex = proposal.changedLines.findIndex(c => c.start === range.start && c.end === range.end);
      if (proposalIndex === -1) {
        throw new Error(`Change range not found in proposal`);
      }
      return await this.rejectSingleChange(proposalId, proposalIndex);
    }
    // Otherwise, reject all changes and close proposal
    if (proposal.editorUri) {
      const tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
      for (const tab of tabs) {
        if (tab.input instanceof vscode.TabInputText && tab.input.uri.toString() === proposal.editorUri.toString()) {
          await vscode.window.tabGroups.close(tab);
        }
      }
    }
    this.deleteProposal(proposalId);
    return `Rejected all changes and closed proposal for ${proposal.filePath}`;
  }

  private calculateDiff(
    originalContent: string,
    proposedContent: string
  ): { start: number; end: number }[] {
    const originalLines = originalContent.split("\n");
    const proposedLines = proposedContent.split("\n");
    const changedLines: { start: number; end: number }[] = [];

    const maxLen = Math.max(originalLines.length, proposedLines.length);
    let currentRange: { start: number; end: number } | null = null;

    for (let k = 0; k < maxLen; k++) {
      const original = originalLines[k] || "";
      const proposed = proposedLines[k] || "";

      if (original !== proposed) {
        if (!currentRange) {
          currentRange = { start: k, end: k };
        } else {
          currentRange.end = k;
        }
      } else {
        if (currentRange) {
          changedLines.push(currentRange);
          currentRange = null;
        }
      }
    }

    if (currentRange) {
      changedLines.push(currentRange);
    }

    return changedLines;
  }

  private highlightChangedLines(editor: vscode.TextEditor, changedLines: { start: number; end: number }[]): void {
    const decorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor("editor.findMatchHighlightBackground"),
      border: "1px solid",
      borderColor: new vscode.ThemeColor("editor.findMatchBorder"),
    });

    const ranges: vscode.Range[] = [];
    const originalLines = this.getOriginalContentForEditor(editor).split("\n");
    const proposedLines = editor.document.getText().split("\n");

    // For each changed line range, find the specific words that changed
    for (const range of changedLines) {
      for (let lineNum = range.start; lineNum <= range.end && lineNum < proposedLines.length; lineNum++) {
        const originalLine = originalLines[lineNum] || "";
        const proposedLine = proposedLines[lineNum] || "";

        if (originalLine !== proposedLine) {
          // Find the specific changed regions within the line
          const changedRanges = this.getCharacterDifferences(originalLine, proposedLine);
          for (const charRange of changedRanges) {
            ranges.push(
              new vscode.Range(
                new vscode.Position(lineNum, charRange.start),
                new vscode.Position(lineNum, charRange.end)
              )
            );
          }
        }
      }
    }

    editor.setDecorations(decorationType, ranges);
  }

  private getOriginalContentForEditor(editor: vscode.TextEditor): string {
    // Find the original content from the proposal
    const proposal = this.getProposalByEditorUri(editor.document.uri);
    return proposal?.originalContent || "";
  }

  private getCharacterDifferences(original: string, proposed: string): { start: number; end: number }[] {
    const ranges: { start: number; end: number }[] = [];
    
    let i = 0;
    let j = 0;
    let currentRange: { start: number; end: number } | null = null;

    const maxLen = Math.max(original.length, proposed.length);

    while (i < original.length || j < proposed.length) {
      const origChar = original[i];
      const propChar = proposed[j];

      if (origChar === propChar) {
        if (currentRange) {
          ranges.push(currentRange);
          currentRange = null;
        }
        i++;
        j++;
      } else {
        if (!currentRange) {
          currentRange = { start: j, end: j };
        }
        
        // Advance both pointers to find next match
        if (i < original.length && j < proposed.length) {
          j++;
          if (!currentRange) {
            currentRange = { start: j - 1, end: j };
          } else {
            currentRange.end = j;
          }
        } else if (i < original.length) {
          i++;
        } else {
          j++;
          if (currentRange) {
            currentRange.end = j;
          }
        }
      }
    }

    if (currentRange) {
      ranges.push(currentRange);
    }

    return ranges;
  }

  async acceptSingleChange(proposalId: string, changeIndex: number): Promise<string> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || !proposal.changedLines) {
      throw new Error(`Proposal ${proposalId} not found or has no changes`);
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error("No workspace folder is open");
    }

    const change = proposal.changedLines[changeIndex];
    if (!change) {
      throw new Error(`Change index ${changeIndex} not found in proposal`);
    }

    // Read current file content
    const fileUri = resolveUri(proposal.filePath, workspaceFolders);
    const fileData = await vscode.workspace.fs.readFile(fileUri);
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    const currentContent = decoder.decode(fileData);
    const currentLines = currentContent.split("\n");
    const proposedLines = proposal.proposedContent.split("\n");

    // Replace only the changed lines
    for (let line = change.start; line <= change.end; line++) {
      currentLines[line] = proposedLines[line];
    }
    const newContent = currentLines.join("\n");
    await vscode.workspace.fs.writeFile(fileUri, encoder.encode(newContent));

    // Update proposal: remove this change, update originalContent
    proposal.originalContent = newContent;
    proposal.changedLines.splice(changeIndex, 1);

    // If no more changes, close proposal
    if (proposal.changedLines.length === 0) {
      if (proposal.editorUri) {
        const tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
        for (const tab of tabs) {
          if (tab.input instanceof vscode.TabInputText && tab.input.uri.toString() === proposal.editorUri.toString()) {
            await vscode.window.tabGroups.close(tab);
          }
        }
      }
      this.deleteProposal(proposalId);
      this.onDidChangeCodeLensesEmitter.fire();
      return `Accepted change and closed proposal for ${proposal.filePath}`;
    } else {
      // Recalculate changedLines for remaining changes (in case line numbers shifted)
      proposal.changedLines = this.calculateDiff(proposal.originalContent, proposal.proposedContent);
      // Re-highlight in editor
      if (proposal.editorUri) {
        const doc = await vscode.workspace.openTextDocument(proposal.editorUri);
        const editor = await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Active });
        this.highlightChangedLines(editor, proposal.changedLines);
      }
      this.onDidChangeCodeLensesEmitter.fire();
      return `Accepted change in ${proposal.filePath}`;
    }
  }

  async rejectSingleChange(proposalId: string, changeIndex: number): Promise<string> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || !proposal.changedLines) {
      throw new Error(`Proposal ${proposalId} not found or has no changes`);
    }

    // Remove the change from changedLines
    proposal.changedLines.splice(changeIndex, 1);

    // If no more changes, close proposal
    if (proposal.changedLines.length === 0) {
      if (proposal.editorUri) {
        const tabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs);
        for (const tab of tabs) {
          if (tab.input instanceof vscode.TabInputText && tab.input.uri.toString() === proposal.editorUri.toString()) {
            await vscode.window.tabGroups.close(tab);
          }
        }
      }
      this.deleteProposal(proposalId);
      this.onDidChangeCodeLensesEmitter.fire();
      return `Rejected change and closed proposal for ${proposal.filePath}`;
    } else {
      // Re-highlight remaining changes in editor
      if (proposal.editorUri) {
        const doc = await vscode.workspace.openTextDocument(proposal.editorUri);
        const editor = await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Active });
        this.highlightChangedLines(editor, proposal.changedLines);
      }
      this.onDidChangeCodeLensesEmitter.fire();
      return `Rejected change in ${proposal.filePath}`;
    }
  }
}

// Text document provider for virtual proposal documents
export class ProposalDocumentProvider implements vscode.TextDocumentContentProvider {
  constructor(private proposalManager: ProposalManager) {}

  onDidChange?: vscode.Event<vscode.Uri> | undefined;

  provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string> {
    // Parse proposal ID from URI authority (format: file-proposal://proposal_0/path/to/file)
    const proposalId = uri.authority;
    const proposal = this.proposalManager.getProposal(proposalId);

    if (!proposal) {
      console.error(`Proposal ${proposalId} not found. Available proposals:`, 
        Array.from((this.proposalManager as any).proposals?.keys() || []));
      return "Proposal not found or has been closed.";
    }

    return proposal.proposedContent;
  }
}

// CodeLens provider for showing accept/reject buttons
export class ProposalCodeLensProvider implements vscode.CodeLensProvider {
  private codeLenses: vscode.CodeLens[] = [];
  private onDidChangeCodeLensesEmitter = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this.onDidChangeCodeLensesEmitter.event;

  constructor(private proposalManager: ProposalManager) {
    proposalManager.onProposalCreated.event(() => this.onDidChangeCodeLensesEmitter.fire());
    proposalManager.onProposalClosed.event(() => this.onDidChangeCodeLensesEmitter.fire());
    // Listen for code lens refresh events from ProposalManager
    proposalManager.onDidChangeCodeLensesEmitter.event(() => this.onDidChangeCodeLensesEmitter.fire());
  }

  provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] {
    this.codeLenses = [];

    const proposal = this.proposalManager.getProposalByEditorUri(document.uri);
    if (!proposal || !proposal.changedLines) {
      return [];
    }

    const proposalId = this.proposalManager.getProposalIdByEditorUri(document.uri);
    if (!proposalId) {
      return [];
    }

    // Only show buttons for remaining changedLines
    for (const range of proposal.changedLines) {
      const startLine = range.start;

      // Accept button
      const acceptLens = new vscode.CodeLens(
        new vscode.Range(new vscode.Position(startLine, 0), new vscode.Position(startLine, 0)),
        {
          title: "✓ Accept",
          command: "proposal.accept",
          arguments: [proposalId, range],
          tooltip: "Accept this change",
        }
      );

      // Reject button
      const rejectLens = new vscode.CodeLens(
        new vscode.Range(new vscode.Position(startLine, 0), new vscode.Position(startLine, 0)),
        {
          title: "✗ Reject",
          command: "proposal.reject",
          arguments: [proposalId, range],
          tooltip: "Reject this change",
        }
      );

      this.codeLenses.push(acceptLens, rejectLens);
    }

    // When a change is accepted/rejected, it is removed from changedLines, so its buttons disappear on next refresh
    return this.codeLenses;
  }
}
