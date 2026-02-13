import { 
  MessageEvent,
  UserState,
  SpecialInstruction
} from "../type.js";

export class SpecialInstructionsHandler {
  private _specialInstructions: SpecialInstruction[];
  private _activeSpecialInstructionId: string | null;

  constructor(private _userState: UserState, private setUserState: (state: UserState) => void, private _sendMessage: (message: MessageEvent) => void) {
    this._specialInstructions = _userState.specialInstructions ? [..._userState.specialInstructions] : [];
    this._activeSpecialInstructionId = _userState.activeSpecialInstructionId ?? null;
  }

  private _generateInstructionId(): string {
    return `si_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  createSpecialInstruction(title: string, content: string) {
    const newInstruction: SpecialInstruction = {
      id: this._generateInstructionId(),
      title: title.trim() || "Untitled",
      content,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this._specialInstructions.push(newInstruction);
    this._activeSpecialInstructionId = newInstruction.id;
    this._persistState();
    this._broadcastSpecialInstructions();
  }

  updateSpecialInstruction(id: string, title?: string, content?: string) {
    const instruction = this._specialInstructions.find(i => i.id === id);
    if (!instruction) {
      this._sendMessage({ type: "error", data: { text: "Instruction not found." } });
      return;
    }

    if (title !== undefined) {
      instruction.title = title.trim() || "Untitled";
    }
    if (content !== undefined) {
      instruction.content = content;
    }
    instruction.updatedAt = Date.now();

    this._persistState();
    this._broadcastSpecialInstructions();
  }

  deleteSpecialInstruction(id: string) {
    this._specialInstructions = this._specialInstructions.filter(i => i.id !== id);

    if (this._activeSpecialInstructionId === id) {
      this._activeSpecialInstructionId = null;
    }

    this._persistState();
    this._broadcastSpecialInstructions();
  }

  setActiveSpecialInstruction(id: string | null) {
    if (id !== null) {
      const exists = this._specialInstructions.some(i => i.id === id);
      if (!exists) {
        this._sendMessage({ type: "error", data: { text: "Instruction not found." } });
        return;
      }
    }

    this._activeSpecialInstructionId = id;
    this._persistState();
    this._broadcastSpecialInstructions();
  }

  getActiveInstructionContent(): string | undefined {
    if (!this._activeSpecialInstructionId) {
      return undefined;
    }
    const active = this._specialInstructions.find(
      i => i.id === this._activeSpecialInstructionId
    );
    return active?.content;
  }

  private _broadcastSpecialInstructions() {
    this._sendMessage({
      type: "specialInstructionsUpdated",
      data: {
        specialInstructions: this.getSpecialInstructions(),
        activeSpecialInstructionId: this._activeSpecialInstructionId
      }
    });
  }

  getSpecialInstructions() {
    return [...this._specialInstructions];
  }

  getActiveSpecialInstructionId() {
    return this._activeSpecialInstructionId;
  }

  private _persistState() {
    this.setUserState({
      ...this._userState,
      initialized: true,
      specialInstructions: this._specialInstructions,
      activeSpecialInstructionId: this._activeSpecialInstructionId
    });
  }
}