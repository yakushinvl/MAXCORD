import React, { useState } from 'react';
import './ReportModal.css';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { reason: string; description: string }) => void;
  username: string;
}

const REASONS = [
  { 
    id: 'harassment', 
    title: 'Домогательства / Хейт', 
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m14.5 9-5 5"/><path d="m9.5 9 5 5"/>
      </svg>
    ), 
    desc: 'Оскорбления, угрозы или преследование' 
  },
  { 
    id: 'spam', 
    title: 'Спам / Реклама', 
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8"/><path d="M8 13h6"/>
      </svg>
    ), 
    desc: 'Нежелательные сообщения и ссылки' 
  },
  { 
    id: 'inappropriate_content', 
    title: 'Неприемлемый контент', 
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 10h.01"/><path d="M15 10h.01"/><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/>
      </svg>
    ), 
    desc: 'Шокирующий или запрещенный материал' 
  },
  { 
    id: 'scam', 
    title: 'Мошенничество', 
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
    ), 
    desc: 'Попытки обмана или фишинга' 
  },
  { 
    id: 'other', 
    title: 'Другое', 
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
      </svg>
    ), 
    desc: 'Нарушение иных правил сообщества' 
  },
];

const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, onSubmit, username }) => {
  const [reason, setReason] = useState('harassment');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  return (
    <div className="report-modal-overlay" onClick={onClose}>
      <div className="report-modal-content" onClick={e => e.stopPropagation()}>
        <div className="report-modal-header">
          <h2>Жалоба на {username}</h2>
          <button className="close-btn" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        
        <div className="report-modal-body">
          <div className="form-group">
            <label>Укажите причину</label>
            <div className="reason-grid">
              {REASONS.map((opt) => (
                <div 
                  key={opt.id} 
                  className={`reason-option ${reason === opt.id ? 'selected' : ''}`}
                  onClick={() => setReason(opt.id)}
                >
                  <div className="reason-icon">{opt.icon}</div>
                  <div className="reason-text">
                    <span className="reason-title">{opt.title}</span>
                    <span className="reason-desc">{opt.desc}</span>
                  </div>
                  {reason === opt.id && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <div className="form-group">
            <label>Дополнительное описание</label>
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              placeholder="Если есть важные детали, укажите их здесь..."
              maxLength={1000}
            />
          </div>
        </div>
        
        <div className="report-modal-footer">
          <button className="cancel-btn" onClick={onClose}>Отмена</button>
          <button className="submit-btn" onClick={() => onSubmit({ reason, description })}>Отправить</button>
        </div>
      </div>
    </div>
  );
};

export default ReportModal;
