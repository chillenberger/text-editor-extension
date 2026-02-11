export interface UserState {
  initialized: boolean;
  messageHistory?: Array<ToolCallMessage | ToolResultMessage | HumanMessage | AssistantMessage>;
  specialInstructions?: SpecialInstruction[];
  activeSpecialInstructionId?: string | null;
}

export interface VsCodeMessage {
    command: 
    | "ready" 
    | "chatMessage" 
    | "refresh" 
    | "createSpecialInstruction" 
    | "updateSpecialInstruction" 
    | "deleteSpecialInstruction" 
    | "setActiveSpecialInstruction";
  text?: string;
  data?: {
    id?: string;
    title?: string;
    content?: string;
  };
}

export type RequestModes = "plan" | "execute" | "auto";
export type ResponseModes = "planned" | "executed";

export interface PlanningRequest {
  input: {
    messages: Array<ToolCallMessage | ToolResultMessage | HumanMessage | AssistantMessage>;
    new_message: ToolCallMessage | ToolResultMessage | HumanMessage | AssistantMessage;
    mode: RequestModes;
  };
}

export interface PlanningResponse {
  output: {
    message: ToolCallMessage | ToolResultMessage | HumanMessage | AssistantMessage;
    mode: ResponseModes;
  }
}

export interface ToolCall {
  tool: string;
  arguments: Record<string, any>;
}

export interface SpecialInstruction {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

/* 
  Message: human or assistant conversation,
  Error: error message to display in UI,
  Working: Display inner workings of system (e.g. "Calling tool X with arguments Y"),
  ClearState: Clear conversation history and reset state,
  Initialize: Initial message from extension to populate UI with existing conversation history.
  Tool_call: Message to indicate a tool is being called with arguments, used to update UI with current tool calls.
*/
export interface MessageEvent {
  type: 
    "message" 
    | "error" 
    | "working" 
    | "clearState" 
    | "initialize" 
    | "tool_call" 
    | "tool_use" 
    | "specialInstructionsUpdated";
  data: {
    messages?: Array<ToolCallMessage | ToolResultMessage | HumanMessage | AssistantMessage>;
    text?: string;
    specialInstructions?: SpecialInstruction[];
    activeSpecialInstructionId?: string | null;
  };
}

// Request to run a local tool from the assistant.
export interface ToolCallMessage {
  type: "tool_call";
  tool: {
    name: string;
    args: Record<string, any>;
    id: string;
    type: string;
  }
}

export function toolCallMessage(content: string, toolCallId: string, toolName: string): ToolCallMessage {
  return {
    type: "tool_call",
    tool: {
      name: toolName,
      args: JSON.parse(content),
      id: toolCallId,
      type: "tool_call",
    }
  }
}

// Response to ran local tool.
export interface ToolResultMessage {
  type: "tool";
  content: string;
  tool_call_id: string;
  tool_name: string;
}

export function toolResultMessage(content: string, toolCallId: string, toolName: string): ToolResultMessage {
  return {
    type: "tool",
    content,
    tool_call_id: toolCallId,
    tool_name: toolName,
  }
}

export interface HumanMessage {
  type: "human";
  content: string;
}

export function humanMessage(content: string): HumanMessage {
  return {
    type: "human",
    content,
  }
}

export interface AssistantMessage {
  type: "assistant";
  content: string;
}

export function assistantMessage(content: string): AssistantMessage {
  return {
    type: "assistant",
    content,
  }
}