import * as z from "zod";
/*
* Type to track path types 
*/
export type RelativePath = string & {__brand: "relativePath"};
export type AbsolutePath = string & {__brand: "absolutePath"};

// Request to run a local tool from the assistant.
export interface APICallToolRequest {
  type: "call_tool";
  tool: {
    name: string;
    args: Record<string, any>;
    id: string;
    type: string;
  }
}
export const apiCallToolRequestSchema: z.ZodType<APICallToolRequest> = z.object({
  type: z.literal("call_tool").default("call_tool"),
  tool: z.object({
    name: z.string(),
    args: z.record(z.string(), z.any()),
    id: z.string(),
    type: z.string()
  })
})

// Response from local tool.
export interface ExtensionAPIUseToolResponse {
  type: "tool";
  content: string;
  tool: {
    name: string;
    id: string;
  }
}
export const extensionAPIUseToolResponseSchema: z.ZodType<ExtensionAPIUseToolResponse> = z.object({
  type: z.literal("tool").default("tool"),
  content: z.string(),
  tool: z.object({
    name: z.string(),
    id: z.string()
  })
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
  messageHistory?: Array<APICallToolRequest | ExtensionAPIUseToolResponse | HumanMessage | AssistantMessage>;
  specialInstructions?: SpecialInstruction[];
  activeSpecialInstructionId?: string | null;
}

export interface File {
  type: 'file' | 'directory';
  name: string;
  relativePath: RelativePath;
  fullPath: AbsolutePath;
}


export interface CommandTemplate<T> {
  command: string;
  data?: T;
}
/* 
* Extension -> webview messages
*/
export type ExtensionPostCommand = 
  | ExtensionPostCommandInitialize
  | ExtensionPostCommandSetWorking
  | ExtensionPostCommandSetToolCalled
  | ExtensionPostCommandSetToolUsed
  | ExtensionPostCommandUpdatedSpecialInstructions
  | ExtensionPostCommandSetActiveTab
  | ExtensionPostCommandClearMessages
  | ExtensionPostCommandSetError
  | ExtensionPostCommandPostMessage;

export interface ExtensionPostCommandInitialize extends CommandTemplate<{
  messages: Array<APICallToolRequest | ExtensionAPIUseToolResponse | HumanMessage | AssistantMessage>;
  specialInstructions: SpecialInstruction[];
  activeSpecialInstructionId: string | null;
  activeTab: File | null;
}> {
  command: "initialize";
}

export interface ExtensionPostCommandSetWorking extends CommandTemplate<{
  text: string;
}> {
  command: "setWorking";
}

export interface ExtensionPostCommandSetToolCalled extends CommandTemplate<{
  messages: Array<APICallToolRequest>;
}> {
  command: "setToolCalled";
}

export interface ExtensionPostCommandSetToolUsed extends CommandTemplate<{
  text: string;
}> {
  command: "setToolUsed";
}

export interface ExtensionPostCommandPostMessage extends CommandTemplate<{
  messages: Array<APICallToolRequest | ExtensionAPIUseToolResponse | HumanMessage | AssistantMessage>;
}> {
  command: "postMessage";
}

export interface ExtensionPostCommandClearMessages extends CommandTemplate<undefined> {
  command: "clearMessages";
}

export interface ExtensionPostCommandUpdatedSpecialInstructions extends CommandTemplate<{
  specialInstructions: SpecialInstruction[];
  activeSpecialInstructionId: string | null;
}> {
  command: "updatedSpecialInstructions";
}

export interface ExtensionPostCommandSetActiveTab extends CommandTemplate<{
  activeTab: File | null;
}> {
  command: "setActiveTab";
}

export interface ExtensionPostCommandSetError extends CommandTemplate<{
  text: string;
}> {
  command: "setError";
}

/* 
* webview -> extension messages
*/
export type WebviewPostCommand =
  | WebviewPostCommandReady
  | WebviewPostCommandRefresh
  | WebviewPostCommandPostMessage
  | WebviewPostCommandCreateSpecialInstruction
  | WebviewPostCommandUpdateSpecialInstruction
  | WebviewPostCommandDeleteSpecialInstruction
  | WebviewPostCommandSetActiveSpecialInstruction;

/* 
* Agent API related types and contracts
*/
export interface WebviewPostCommandReady extends CommandTemplate<undefined> {
  command: "ready";
}

export interface WebviewPostCommandRefresh extends CommandTemplate<undefined> {
  command: "refresh";
}

export interface WebviewPostCommandPostMessage extends CommandTemplate<{
  content: string;
  referenceFiles?: Array<RelativePath>;
}> {
  command: "postMessage";
}

export interface WebviewPostCommandCreateSpecialInstruction extends CommandTemplate<{
  title: string;
  content: string;
}> {
  command: "createSpecialInstruction";
}

export interface WebviewPostCommandUpdateSpecialInstruction extends CommandTemplate<{
  id: string;
  title?: string;
  content?: string;
}> {
  command: "updateSpecialInstruction";
}

export interface WebviewPostCommandDeleteSpecialInstruction extends CommandTemplate<{
  id: string;
}> {
  command: "deleteSpecialInstruction";
}

export interface WebviewPostCommandSetActiveSpecialInstruction extends CommandTemplate<{
  id: string | null;
}> {
  command: "setActiveSpecialInstruction";
}

/*
* Agent api request contract
*/
export interface PlanningRequest {
  input: {
    messages: Array<APICallToolRequest | ExtensionAPIUseToolResponse | HumanMessage | AssistantMessage>;
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
    message: APICallToolRequest | ExtensionAPIUseToolResponse | HumanMessage | AssistantMessage;
    mode: ResponseModes;
  }
}
export const PlanningResponseSchema: z.ZodType<PlanningResponse> = z.object({
  output: z.object({
    message: z.union([apiCallToolRequestSchema, extensionAPIUseToolResponseSchema, humanMessageSchema, assistantMessageSchema]),
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
