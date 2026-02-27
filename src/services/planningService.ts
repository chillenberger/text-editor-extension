import { 
  PlanningRequest, 
  PlanningResponse, 
  ToolCallMessage, 
  ToolResultMessage, 
  HumanMessage, 
  AssistantMessage,
  ExtensionPostCommand,
  PlanningResponseSchema,
  RequestModes,
  ResponseModes,
  RelativePath, 
  toolResultMessageSchema,
  humanMessageSchema,
 } from "../type.js";
import { ToolExecutor } from "./toolExecutor.js";
import * as vscode from 'vscode';
import * as z from 'zod';

const PLANNING_API_URL = "http://localhost:8000/agent/invoke";

interface InvokePlan {
  messages: Array<ToolCallMessage | ToolResultMessage | HumanMessage | AssistantMessage>;
  mode: RequestModes;
  specialInstructions?: string;
  referenceFiles?: Array<RelativePath>;
}

interface ExecutePlanningLoop {
  messages: Array<ToolCallMessage | ToolResultMessage | HumanMessage | AssistantMessage>;
  specialInstructions?: string;
  referenceFiles?: Array<RelativePath>;
}

export class PlanningService {
  private webviewMessenger: (message: ExtensionPostCommand) => void = () => {};
  constructor(private toolExecutor: ToolExecutor) {}

  async invokePlan({messages, mode, specialInstructions, referenceFiles}: InvokePlan): Promise<PlanningResponse> {
    const body: PlanningRequest = {
      input: {
        messages: messages,
        mode: mode,
        special_instructions: specialInstructions,
        reference_files: referenceFiles || []
      },
    };
    
    try {
      const response: Response = await fetch(PLANNING_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Planning API error: ${response.statusText}`);
      }

      const json = await response.json();
      return PlanningResponseSchema.parse(json);
    } catch (error) {
      const errorMessage = error instanceof z.ZodError
        ? `Planning API response validation error: ${error.message}`
        : `Failed to invoke plan: ${error instanceof Error ? error.message : "Unknown error"}`;
      vscode.window.showErrorMessage(errorMessage );
      throw new Error(errorMessage);
    }
  }

  async executePlanningLoop({messages, specialInstructions, referenceFiles}: ExecutePlanningLoop): Promise<Array<ToolCallMessage | ToolResultMessage | HumanMessage | AssistantMessage>> {
    let iterations = 0;
    const maxIterations = 10;

    let responseMode: ResponseModes | null = null;
    while (true) {
      try {
        this._sendMessage({ type: "working", data: { text: `Working...` } });

        // For now 0 -> 1 planning cycles allowed. 
        const requestMode = !responseMode ? "auto" : "execute";
        const parsedResponse: PlanningResponse = await this.invokePlan({messages, mode: requestMode, specialInstructions, referenceFiles});
        const output: ToolCallMessage | ToolResultMessage | HumanMessage | AssistantMessage = parsedResponse.output.message;
        responseMode = parsedResponse.output.mode;
        
        messages.push(output);

        if (responseMode === "planned") {
          // TODO: Add user permissions and insight
          messages.push(
            humanMessageSchema.parse({content: "Execute the plan"})
          );
          continue;
        } else {
          if ( output.type === "assistant") {
            // Assistant message is the final output of a request
            break;
          } else if (output.type === "tool_call" && output.tool) {
            this._sendMessage({ type: "tool_call", data: { messages: [output] } });

            const message = await this._handleToolCall(output);
            messages.push(message);
            continue;
          }
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Error during planning loop: ${error instanceof Error ? error.message : "Unknown error"}`);
        // TODO: return error message to conversation
        break;
      }
      iterations++;
      if (iterations >= maxIterations) throw new Error("Max planning iterations reached");
    }

    // Return final output message only
    return messages.slice(messages.length - iterations - 1) as Array<ToolCallMessage | ToolResultMessage | HumanMessage | AssistantMessage>;
  }

  private async _handleToolCall(toolCall: ToolCallMessage): Promise<ToolResultMessage> {
    try {
      const result = await this.toolExecutor.execute({tool: toolCall.tool.name, arguments: toolCall.tool.args});
      return toolResultMessageSchema.parse({
        content: result, 
        tool_call_id: toolCall.tool.id, 
        tool_name: toolCall.tool.name
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Error executing tool ${toolCall.tool.name}: ${error instanceof Error ? error.message : "Unknown error"}`);
      return toolResultMessageSchema.parse(
        {
          content: "Error executing tool",
          tool_call_id: toolCall.tool.id,
          tool_name: toolCall.tool.name
        }
      );
    }
  }

  public setWebviewMessenger(messenger: (message: ExtensionPostCommand) => void) {
    this.webviewMessenger = messenger;
  }

  private _sendMessage(message: ExtensionPostCommand) {
    this.webviewMessenger(message);
  }
}
