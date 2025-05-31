import React from 'react';
import InfoIcon from '@mui/icons-material/Info';
import useGameStore from '../../stores/useGameStore';

export const FeedbackButton: React.FC = () => {
  const isDevelopment = import.meta.env.DEV;
  const { openInfoModal, showInfoModal } = useGameStore(state => ({
    openInfoModal: state.openInfoModal,
    showInfoModal: state.showInfoModal,
  }));

  // Don't render the buttons when the info modal is open
  if (showInfoModal) {
    return null;
  }

  return (
    <div className={`floating-container ${isDevelopment ? 'dev-mode' : ''}`}>
      {/* Info Button */}
      <button
        onClick={openInfoModal}
        className="floating-btn info-btn"
        title="Information Center"
        aria-label="Open Information Center"
      >
        <InfoIcon sx={{ color: 'white', width: 24, height: 24 }} />
      </button>

      {/* Email Button */}
      <a
        href="mailto:dev@babysim.fun"
        className="floating-btn feedback-btn"
        title="Send Feedback"
        aria-label="Send Feedback via Email"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="24"
          height="24"
          aria-hidden="true"
        >
          <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
        </svg>
      </a>
    </div>
  );
}; 