import * as vscode from "vscode";
import { ToolCall } from "../type";
import { ProposalManager, ProposalDocumentProvider, ProposalCodeLensProvider } from "./proposalService.js";
import { FileExtractor, File } from "./fileExtractor";
import { resolveUri } from "../utilities";

export interface ToolHandler {
  (toolCall: ToolCall): Promise<string>;
}

export class ToolExecutor {
  private handlers: Map<string, ToolHandler> = new Map();
  private proposalManager: ProposalManager;
  private static providersRegistered: boolean = false;
  private fileExtractor: FileExtractor = new FileExtractor();

  private disallowedEditFileTypes = new Set<string>([
    ".pdf",
    ".docx",
    ".xlsx",
  ]);

  constructor() {
    this.proposalManager = new ProposalManager();
    this.registerDefaultHandlers();
    this.ensureProvidersRegistered();
  }

  private registerDefaultHandlers() {
    // Workspace-related tools
    this.register("get_workspace_structure", this.handleGetWorkspaceStructure.bind(this));
    this.register("change_file_location", this.handleChangeFileLocation.bind(this));

    // File-related tools
    this.register("create_file", this.createNewFile.bind(this));
    // this.register("update_file", this.createNewFile.bind(this));
    this.register("delete_file", this.deleteFile.bind(this));
    this.register("read_file", this.readFile.bind(this));

    // Proposal tools
    this.register("propose_file_change", this.proposeFileChange.bind(this));
    this.register("accept_proposal", this.acceptProposal.bind(this));
    this.register("reject_proposal", this.rejectProposal.bind(this));
  }

  private ensureProvidersRegistered(): void {
    if (ToolExecutor.providersRegistered) {
      return;
    }

    try {
      const proposalDocProvider = new ProposalDocumentProvider(this.proposalManager);
      const codeLensProvider = new ProposalCodeLensProvider(this.proposalManager);

      vscode.workspace.registerTextDocumentContentProvider(
        "file-proposal",
        proposalDocProvider
      );

      vscode.languages.registerCodeLensProvider("*", codeLensProvider);

      // Register accept command
      vscode.commands.registerCommand("proposal.accept", async (proposalId: string, range: { start: number; end: number }) => {
        try {
          await this.proposalManager.acceptProposal(proposalId, range);
          vscode.window.showInformationMessage("Change accepted!");
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to accept proposal: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      });

      // Register reject command
      vscode.commands.registerCommand("proposal.reject", async (proposalId: string, range: { start: number; end: number }) => {
        try {
          this.proposalManager.rejectProposal(proposalId, range);
          vscode.window.showInformationMessage("Change rejected!");
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to reject proposal: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      });

      ToolExecutor.providersRegistered = true;
    } catch (error) {
      console.error("Failed to register proposal providers:", error);
      // Don't throw - let the tool executor continue working
    }
  }

  register(toolName: string, handler: ToolHandler): void {
    this.handlers.set(toolName, handler);
  }

  async execute(toolCall: ToolCall): Promise<string> {
    const handler = this.handlers.get(toolCall.tool);

    if (!handler) {
      throw new Error(`Unknown tool: ${toolCall.tool}`);
    }

    return handler(toolCall);
  }

  private async readFile(toolCall: ToolCall): Promise<string> {
    const { filePath } = {filePath: toolCall.arguments.path};
    
    if (!filePath) {
      throw new Error("readFile requires filePath");
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders?.length) {
      throw new Error("No workspace folders are open");
    }

    try {
      const fileUri = resolveUri(filePath, workspaceFolders);
      const fileData: Uint8Array = await vscode.workspace.fs.readFile(fileUri);
      const file: File = {
        name: fileUri.path.split('/').pop() || 'unknown',
        type: this.fileExtractor.getFileType(filePath) || 'text/plain',
        data: fileData
      }

      return await this.fileExtractor.extract(file);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to read file: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      throw error;
    }
  }

  private async createNewFile(toolCall: ToolCall): Promise<string> {
    const { filePath, content } = {filePath: toolCall.arguments.path, content: toolCall.arguments.content};
    
    if (!filePath || content === undefined) {
      throw new Error("createNewFile requires filePath and content");
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      throw new Error("No workspace folder is open");
    }

    try {
      const fileUri = resolveUri(filePath, workspaceFolders);
      const encoder = new TextEncoder();
      const uint8Array = encoder.encode(content);

      await vscode.workspace.fs.writeFile(fileUri, uint8Array);

      return `Successfully created file at ${filePath}`;
    } catch (error) {
      throw new Error(
        `Failed to create file: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private async deleteFile(toolCall: ToolCall): Promise<string> {
    const { filePath } = {filePath: toolCall.arguments.path};
    
    if (!filePath) {
      throw new Error("deleteFile requires filePath");
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      throw new Error("No workspace folder is open");
    }

    try {
      const fileUri = resolveUri(filePath, workspaceFolders);

      await vscode.workspace.fs.delete(fileUri);

      return `Successfully deleted file at ${filePath}`;
    } catch (error) {
      throw new Error(
        `Failed to delete file: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private async handleChangeFileLocation(toolCall: ToolCall): Promise<string> {
    const { oldFilePath, newFilePath } = {oldFilePath: toolCall.arguments.old_path, newFilePath: toolCall.arguments.new_path};
    
    if (!oldFilePath || !newFilePath) {
      throw new Error("changeFileLocation requires oldFilePath and newFilePath");
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      throw new Error("No workspace folder is open");
    }

    try {
      // Convert relative paths to absolute URIs
      const oldUri = resolveUri(oldFilePath, vscode.workspace.workspaceFolders || []);
      const newUri = resolveUri(newFilePath, vscode.workspace.workspaceFolders || []);

      // Read the old file
      const fileContent = await vscode.workspace.fs.readFile(oldUri);

      // Write to new location
      await vscode.workspace.fs.writeFile(newUri, fileContent);

      // Delete old file
      await vscode.workspace.fs.delete(oldUri);

      return `Successfully moved file from ${oldFilePath} to ${newFilePath}`;
    } catch (error) {
      throw new Error(
        `Failed to move file: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private async handleGetWorkspaceStructure(toolCall: ToolCall): Promise<string> {
    if (!vscode.workspace.workspaceFolders) {
      throw new Error("No workspace folder is open");
    }

    const shape = await this.getWorkspaceStructure(vscode.workspace.workspaceFolders);
    return JSON.stringify(shape, null, 2);
  }

  private async getWorkspaceStructure(
    folders: readonly vscode.WorkspaceFolder[]
  ): Promise<Record<string, any>> {
    const shape: Record<string, any> = {};

    for (const folder of folders) {
      shape[folder.name] = await this.getDirShape(folder.uri);
    }

    return shape;
  }

  private async getDirShape(uri: vscode.Uri): Promise<Record<string, any>> {
    try {
      const entries = await vscode.workspace.fs.readDirectory(uri);
      const shape: Record<string, any> = {};

      for (const [name, type] of entries) {
        // Skip hidden files and common ignore patterns
        if (name.startsWith(".")) {
          continue;
        }

        if (type === vscode.FileType.Directory) {
          shape[name] = await this.getDirShape(vscode.Uri.joinPath(uri, name));
        } else if (type === vscode.FileType.File) {
          shape[name] = "file";
        }
      }

      return shape;
    } catch (error) {
      return { error: `Failed to read directory: ${error}` };
    }
  }

  private async proposeFileChange(toolCall: ToolCall): Promise<string> {
    const { filePath, originalContent, proposedContent, description } = {
      filePath: toolCall.arguments.file_path,
      originalContent: toolCall.arguments.original_content,
      proposedContent: toolCall.arguments.proposed_content,
      description: toolCall.arguments.description,
    };

    if (Array.from(this.disallowedEditFileTypes).find(ext => filePath.toLowerCase().endsWith(ext))) {
      return JSON.stringify({
        error: `Proposing changes to files of type ${this.disallowedEditFileTypes} is not supported.`,
      });
    }

    if (!filePath || originalContent === undefined || proposedContent === undefined) {
      throw new Error(
        "propose_file_change requires file_path, original_content, and proposed_content"
      );
    }

    const proposalId = await this.proposalManager.proposeFileChange({
      filePath,
      originalContent,
      proposedContent,
      description,
    });

    return JSON.stringify({
      proposal_id: proposalId,
      file_path: filePath,
      message: `Change proposal created. Review the diff in the editor and use accept_proposal or reject_proposal to proceed.`,
    });
  }

  private async acceptProposal(toolCall: ToolCall): Promise<string> {
    const { proposalId, range } = { proposalId: toolCall.arguments.proposal_id, range: toolCall.arguments.range };

    if (!proposalId) {
      throw new Error("accept_proposal requires proposal_id");
    }

    const result = await this.proposalManager.acceptProposal(proposalId, range);
    return JSON.stringify({
      success: true,
      message: result,
    });
  }

  private async rejectProposal(toolCall: ToolCall): Promise<string> {
    const { proposalId, range } = { proposalId: toolCall.arguments.proposal_id, range: toolCall.arguments.range };
    if (!proposalId) {
      throw new Error("reject_proposal requires proposal_id");
    }

    this.proposalManager.rejectProposal(proposalId, range);
    return JSON.stringify({
      success: true,
      message: `Proposal ${proposalId} rejected and closed.`,
    });
  }
}
