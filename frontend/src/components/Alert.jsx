import './styles/Alert.css';

const Alert = ({ isOpen, onClose, onConfirm, title, children }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h4 className="modal-title">{title}</h4>
          <button onClick={onClose} className="modal-close-button">×</button>
        </div>
        <div className="modal-body">
          {children}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="modal-button cancel">
            Cancel
          </button>
          <button onClick={onConfirm} className="modal-button confirm">
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default Alert;