import type { UseSpecialInstructions } from "../../hooks/useSpecialInstructions"
import './SpecialInstructions.css'

export default function SpecialInstructions({ useSpecialInstructions }: { useSpecialInstructions: UseSpecialInstructions }) {
  const {
    showModal,
    modalView,
    editingId,
    specialInstructions,
    activeInstructionId,
    editTitle,
    setEditTitle,
    editContent,
    setEditContent,
    activeInstruction,
    closeModal,
    startCreate,
    startEdit,
    saveInstruction,
    cancelEdit,
    deleteInstruction,
    selectInstruction
  } = useSpecialInstructions

  return (
    <>
     {/* Active Instruction Badge */}
      {activeInstruction && (
        <div className="active-instruction-banner">
          <details>
            <summary>
              <span className="active-dot" />
              {activeInstruction.title}
            </summary>
            <p className="active-instruction-content">{activeInstruction.content}</p>
          </details>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>

            {/* ---- LIST VIEW ---- */}
            {modalView === 'list' && (
              <>
                <div className="modal-header">
                  <h3>Special Instructions</h3>
                  <button className="modal-close-btn" onClick={closeModal}>✕</button>
                </div>

                <p className="modal-description">
                  Choose which instructions to send to the assistant, or create a new set.
                </p>

                <div className="instruction-list">
                  {/* None option */}
                  <label className={`instruction-item ${activeInstructionId === null ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="activeInstruction"
                      checked={activeInstructionId === null}
                      onChange={() => selectInstruction(null)}
                    />
                    <span className="instruction-item-label">None</span>
                  </label>

                  {specialInstructions.map(si => (
                    <div
                      key={si.id}
                      className={`instruction-item ${activeInstructionId === si.id ? 'active' : ''}`}
                    >
                      <label className="instruction-item-main">
                        <input
                          type="radio"
                          name="activeInstruction"
                          checked={activeInstructionId === si.id}
                          onChange={() => selectInstruction(si.id)}
                        />
                        <div className="instruction-item-info">
                          <span className="instruction-item-title">{si.title}</span>
                          <span className="instruction-item-preview">
                            {si.content.length > 80
                              ? si.content.slice(0, 80) + '…'
                              : si.content}
                          </span>
                        </div>
                      </label>
                      <div className="instruction-item-actions">
                        <button
                          className="icon-btn"
                          title="Edit"
                          onClick={() => startEdit(si)}
                        >
                          ✎
                        </button>
                        <button
                          className="icon-btn danger"
                          title="Delete"
                          onClick={() => deleteInstruction(si.id)}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button className="create-btn" onClick={startCreate}>
                  + Create New
                </button>
              </>
            )}

            {modalView === 'edit' && (
              <>
                <div className="modal-header">
                  <button className="back-btn" onClick={cancelEdit}>←</button>
                  <h3>{editingId ? 'Edit Instruction' : 'New Instruction'}</h3>
                </div>

                <div className="edit-form">
                  <label className="edit-label" htmlFor="si-title">Title</label>
                  <input
                    id="si-title"
                    className="edit-input"
                    type="text"
                    placeholder="e.g. Code Review Rules"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                  />

                  <label className="edit-label" htmlFor="si-content">Instructions</label>
                  <textarea
                    id="si-content"
                    className="edit-textarea"
                    rows={10}
                    placeholder="Enter the instructions the assistant should follow…"
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                  />
                </div>

                <div className="modal-footer">
                  <button className="cancel-btn" onClick={cancelEdit}>Cancel</button>
                  <button
                    className="save-btn"
                    onClick={saveInstruction}
                    disabled={!editTitle.trim() && !editContent.trim()}
                  >
                    {editingId ? 'Save Changes' : 'Create'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
