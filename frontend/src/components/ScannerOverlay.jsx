import './ScannerOverlay.css';

function ScannerOverlay({ scanning = false, status = 'idle', message = '' }) {
  return (
    <div className="scanner-overlay" data-status={status}>
      {/* Corner frame */}
      <div className="scanner-frame">
        <div className="scanner-corner-bl" />
        <div className="scanner-corner-br" />
        {scanning && <div className="scan-sweep" />}
      </div>

      {/* Pulse ring */}
      {scanning && <div className="scanner-pulse" />}

      {/* Status message */}
      {message && (
        <div className="scanner-message">
          <span className={`scanner-message-${status}`}>{message}</span>
        </div>
      )}
    </div>
  );
}

export default ScannerOverlay;
