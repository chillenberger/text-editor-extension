import * as z from "zod";
/*
* Type to track path types 
*/
export type RelativePath = string & {__brand: "relativePath"};
export type AbsolutePath = string & {__brand: "absolutePath"};


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
export const toolCallMessageSchema: z.ZodType<ToolCallMessage> = z.object({
  type: z.literal("tool_call").default("tool_call"),
  tool: z.object({
    name: z.string(),
    args: z.record(z.string(), z.any()),
    id: z.string(),
    type: z.string()
  })
})

// Response from local tool.
export interface ToolResultMessage {
  type: "tool";
  content: string;
  tool_call_id: string;
  tool_name: string;
}
export const toolResultMessageSchema: z.ZodType<ToolResultMessage> = z.object({
  type: z.literal("tool").default("tool"),
  content: z.string(),
  tool_call_id: z.string(),
  tool_name: z.string()
})

// A message from human 
export interface HumanMessage {
  type: "human";
  content: string;
}
export const humanMessageSchema = z.object({
  type: z.literal("human").default("human"),
  content: z.string()
})

// A message from assistant 
export interface AssistantMessage {
  type: "assistant";
  content: string;
}
export const assistantMessageSchema = z.object({
  type: z.literal("assistant").default("assistant"),
  content: z.string()
})

/* 
* Persisted user state contract for conversation history and special instructions.
*/
export interface UserState {
  initialized: boolean;
  messageHistory?: Array<ToolCallMessage | ToolResultMessage | HumanMessage | AssistantMessage>;
  specialInstructions?: SpecialInstruction[];
  activeSpecialInstructionId?: string | null;
}

export interface File {
  type: 'file' | 'directory';
  name: string;
  relativePath: RelativePath;
  fullPath: AbsolutePath;
}

/* 
* Extension -> webview messages
*
* Message: human or assistant conversation,
* Error: error message to display in UI,
* Working: Display inner workings of system (e.g. "Calling tool X with arguments Y"),
* ClearState: Clear conversation history and reset state, as commanded by vscode
* Initialize: Initial message from extension to populate UI with existing conversation history.
* Tool_call: Message to indicate a tool is being called with arguments, used to update UI with current tool calls.
*/
export interface ExtensionPostCommand {
  type: 
    "message" 
    | "error" 
    | "working" 
    | "clearState" 
    | "initialize" 
    | "tool_call" 
    | "tool_use" 
    | "specialInstructionsUpdated"
    | "setCurrentFile"
    | "activeTabUpdate";
  data: {
    messages?: Array<ToolCallMessage | ToolResultMessage | HumanMessage | AssistantMessage>;
    text?: string;
    specialInstructions?: SpecialInstruction[];
    activeSpecialInstructionId?: string | null;
    activeTab?: File | null;
  };
}

/* 
* webview -> extension messages
*
* ready: Indicate webview is ready to receive messages,
* refresh: Clear conversation history and reset state, as commanded by UI.
* chatMessage: A new message from the user to add to the conversation,
* createSpecialInstruction: Create a new special instruction with provided title and content,
* updateSpecialInstruction: Update an existing special instruction with new title and/or content,
* deleteSpecialInstruction: Delete an existing special instruction by id,
* setActiveSpecialInstruction: Set a special instruction as active by id, which will be included in agent planning requests.
*/
export interface WebviewPostCommand {
    command: 
    | "ready" 
    | "refresh"
    | "chatMessage" 
    | "createSpecialInstruction" 
    | "updateSpecialInstruction" 
    | "deleteSpecialInstruction" 
    | "setActiveSpecialInstruction";
  text?: string;
  data?: {
    id?: string;
    title?: string;
    content?: string;
    referenceFiles?: Array<RelativePath>;
  };
}

/*
* Agent api request contract
*/
export interface PlanningRequest {
  input: {
    messages: Array<ToolCallMessage | ToolResultMessage | HumanMessage | AssistantMessage>;
    mode: RequestModes;
    special_instructions?: string;
    reference_files?: Array<RelativePath>;
  };
}

/* 
* Agent API related modes to control planning and execution flow.
* RequestModes:
  - "plan": Only generate a plan without executing tools.
  - "execute": Only execute the provided plan without generating a new one.
  - "auto": Let the agent decide whether to generate a new plan or execute based on the conversation context and previous interactions.
*/
export const RequestModesSchema = z.union([z.literal("plan"), z.literal("execute"), z.literal("auto")]);
export type RequestModes = z.infer<typeof RequestModesSchema>;

/* 
* ResponseModes:
  - "planned": The response contains a generated plan that has not been executed yet.
  - "executed": The response contains the result of executing a plan, which may include tool results and updated conversation messages.
*/
export const ResponseModesSchema = z.union([z.literal("planned"), z.literal("executed")]);
export type ResponseModes = z.infer<typeof ResponseModesSchema>;

/* 
* Agent api response contract
*/
export interface PlanningResponse {
  output: {
    message: ToolCallMessage | ToolResultMessage | HumanMessage | AssistantMessage;
    mode: ResponseModes;
  }
}
export const PlanningResponseSchema: z.ZodType<PlanningResponse> = z.object({
  output: z.object({
    message: z.union([toolCallMessageSchema, toolResultMessageSchema, humanMessageSchema, assistantMessageSchema]),
    mode: ResponseModesSchema
  })
})

export interface SpecialInstruction {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}
