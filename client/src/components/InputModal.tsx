import React, { useState, useEffect, useRef } from 'react';
import './InputModal.css';

interface InputModalProps {
    isOpen: boolean;
    title: string;
    label?: string;
    initialValue?: string;
    placeholder?: string;
    onClose: () => void;
    onSubmit: (value: string) => void;
    type?: 'text' | 'number';
}

const InputModal: React.FC<InputModalProps> = ({
    isOpen,
    title,
    label,
    initialValue = '',
    placeholder = '',
    onClose,
    onSubmit,
    type = 'text'
}) => {
    const [value, setValue] = useState(initialValue);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setValue(initialValue);
            // Focus input after a short delay to ensure modal is rendered
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen, initialValue]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(value);
        onClose();
    };

    return (
        <div className="input-modal-overlay" onClick={onClose}>
            <div className="input-modal-content" onClick={e => e.stopPropagation()}>
                <div className="input-modal-header">
                    <h3>{title}</h3>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="input-modal-body">
                        {label && (
                            <div className="input-group">
                                <label>{label}</label>
                            </div>
                        )}
                        <input
                            ref={inputRef}
                            type={type}
                            className="input-modal-input"
                            value={value}
                            onChange={e => setValue(e.target.value)}
                            placeholder={placeholder}
                        />
                    </div>
                    <div className="input-modal-footer">
                        <button type="button" className="input-modal-cancel" onClick={onClose}>
                            Отмена
                        </button>
                        <button type="submit" className="input-modal-submit">
                            Сохранить
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default InputModal;
