import { request } from "http";
import { 
  PlanningRequest, 
  PlanningResponse, 
  ToolCallMessage, 
  ToolResultMessage, 
  HumanMessage, 
  AssistantMessage,
  MessageEvent,
  toolCallMessage, 
  toolResultMessage,
  humanMessage,
  RequestModes,
  ResponseModes,
  RelativePath
 } from "../type.js";
import { ToolExecutor } from "./toolExecutor.js";
import * as vscode from 'vscode';

const PLANNING_API_URL = "http://localhost:8000/general_agent/invoke";

interface InvokePlan {
  messages: Array<ToolCallMessage | ToolResultMessage | HumanMessage | AssistantMessage>;
  mode: "plan" | "execute" | "auto";
  specialInstructions?: string;
  referenceFiles?: Array<RelativePath>;
}

interface ExecutePlanningLoop {
  messages: Array<ToolCallMessage | ToolResultMessage | HumanMessage | AssistantMessage>;
  specialInstructions?: string;
  referenceFiles?: Array<RelativePath>;
}

export class PlanningService {
  private webviewMessenger: (message: MessageEvent) => void = () => {};
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
      const response = await fetch(PLANNING_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Planning API error: ${response.statusText}`);
      }

      return await response.json() as PlanningResponse;
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to invoke plan: ${error instanceof Error ? error.message : "Unknown error"}`);
      throw new Error(
        `Failed to invoke plan: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async executePlanningLoop({messages, specialInstructions, referenceFiles}: ExecutePlanningLoop): Promise<Array<ToolCallMessage | ToolResultMessage | HumanMessage | AssistantMessage>> {
    let iterations = 0;
    const maxIterations = 10;

    let responseMode: ResponseModes | null = null;
    while (true) {
      try {
        this._sendMessage({ type: "working", data: { text: `Working...` } });

        // Only one planning cycle then only execute. 
        const requestMode = !responseMode ? "auto" : "execute";
        const parsedResponse: PlanningResponse = await this.invokePlan({messages, mode: requestMode, specialInstructions, referenceFiles});
        const output: ToolCallMessage | ToolResultMessage | HumanMessage | AssistantMessage = parsedResponse.output.message;
        responseMode = parsedResponse.output.mode;
        // messages.push(...[newMessage, output]);
        messages.push(output);

        if (responseMode === "planned") {
          messages.push(humanMessage("Execute the plan"));
          continue;
        } else {
          if ( output.type === "assistant") {
            break;
          } else if (output.type === "tool_call" && output.tool) {
            this._sendMessage({ type: "tool_call", data: { messages: [output] } });
            const toolCall = output.tool;
            try {
              const resultMessage = await this.toolExecutor.execute({tool: toolCall.name, arguments: toolCall.args});
              // newMessage = toolResultMessage(resultMessage, toolCall.id, toolCall.name);
              messages.push(toolResultMessage(resultMessage, toolCall.id, toolCall.name));

            } catch (error) {
              vscode.window.showErrorMessage(`Error executing tool ${toolCall.name}: ${error instanceof Error ? error.message : "Unknown error"}`);
              // newMessage = toolResultMessage(`Error executing tool: ${error instanceof Error ? error.message : "Unknown error"}`, toolCall.id, toolCall.name);
              messages.push(toolResultMessage(`Error executing tool: ${error instanceof Error ? error.message : "Unknown error"}`, toolCall.id, toolCall.name));
            }
            continue;
          }
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Error during planning loop: ${error instanceof Error ? error.message : "Unknown error"}`);
        break;
      }
      iterations++;
      if (iterations >= maxIterations) throw new Error("Max planning iterations reached");
    }

    // Return final output message only
    return messages.slice(messages.length - iterations - 1) as Array<ToolCallMessage | ToolResultMessage | HumanMessage | AssistantMessage>;
  }

  public setWebviewMessenger(messenger: (message: MessageEvent) => void) {
    this.webviewMessenger = messenger;
  }

  private _sendMessage(message: MessageEvent) {
    this.webviewMessenger(message);
  }
}
