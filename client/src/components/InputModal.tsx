import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';

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
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen, initialValue]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(value);
        onClose();
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title={title}
            size="sm"
            footer={
                <>
                    <button type="button" className="zv-btn zv-btn--ghost" onClick={onClose}>
                        Отмена
                    </button>
                    <button type="submit" form="input-modal-form" className="zv-btn zv-btn--primary">
                        Сохранить
                    </button>
                </>
            }
        >
            <form id="input-modal-form" onSubmit={handleSubmit}>
                {label && (
                    <label
                        style={{
                            display: 'block',
                            color: 'var(--text-dim)',
                            fontSize: 12,
                            fontWeight: 600,
                            marginBottom: 8,
                        }}
                    >
                        {label}
                    </label>
                )}
                <input
                    ref={inputRef}
                    type={type}
                    className="auth-input-glass"
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    placeholder={placeholder}
                    style={{ fontSize: 15 }}
                />
            </form>
        </Modal>
    );
};

export default InputModal;
