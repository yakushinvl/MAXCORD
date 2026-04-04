import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import './Dialog.css'; // Create this CSS file next

interface DialogOptions {
    title: string;
    message: string;
    type: 'alert' | 'confirm' | 'prompt';
    confirmText?: string;
    cancelText?: string;
    defaultValue?: string; // For prompt
    placeholder?: string; // For prompt
}

interface DialogContextType {
    alert: (message: string, title?: string) => Promise<void>;
    confirm: (message: string, title?: string, confirmText?: string, cancelText?: string) => Promise<boolean>;
    prompt: (message: string, defaultValue?: string, title?: string) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const useDialog = () => {
    const context = useContext(DialogContext);
    if (!context) {
        throw new Error('useDialog must be used within a DialogProvider');
    }
    return context;
};

interface DialogState extends DialogOptions {
    resolve: (value: any) => void;
    isOpen: boolean;
}

export const DialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [dialogState, setDialogState] = useState<DialogState | null>(null);
    const [inputValue, setInputValue] = useState('');

    const alert = useCallback((message: string, title = 'Внимание') => {
        return new Promise<void>((resolve) => {
            setDialogState({
                title,
                message,
                type: 'alert',
                isOpen: true,
                resolve: () => {
                    setDialogState(null);
                    resolve();
                }
            });
        });
    }, []);

    const confirm = useCallback((message: string, title = 'Подтверждение', confirmText = 'Да', cancelText = 'Отмена') => {
        return new Promise<boolean>((resolve) => {
            setDialogState({
                title,
                message,
                type: 'confirm',
                confirmText,
                cancelText,
                isOpen: true,
                resolve: (value: boolean) => {
                    setDialogState(null);
                    resolve(value);
                }
            });
        });
    }, []);

    const prompt = useCallback((message: string, defaultValue = '', title = 'Ввод') => {
        setInputValue(defaultValue);
        return new Promise<string | null>((resolve) => {
            setDialogState({
                title,
                message,
                type: 'prompt',
                defaultValue,
                isOpen: true,
                resolve: (value: string | null) => {
                    setDialogState(null);
                    resolve(value);
                }
            });
        });
    }, []);

    const handleConfirm = () => {
        if (!dialogState) return;
        if (dialogState.type === 'prompt') {
            dialogState.resolve(inputValue);
        } else {
            dialogState.resolve(true);
        }
    };

    const handleCancel = () => {
        if (!dialogState) return;
        if (dialogState.type === 'prompt') {
            dialogState.resolve(null);
        } else {
            dialogState.resolve(false);
        }
    };

    return (
        <DialogContext.Provider value={{ alert, confirm, prompt }}>
            {children}
            {dialogState && dialogState.isOpen && (
                <div className="custom-dialog-overlay">
                    <div className="custom-dialog-container">
                        <h3 className="custom-dialog-title">{dialogState.title}</h3>
                        <p className="custom-dialog-message">{dialogState.message}</p>

                        {dialogState.type === 'prompt' && (
                            <input
                                type="text"
                                className="custom-dialog-input"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleConfirm();
                                    if (e.key === 'Escape') handleCancel();
                                }}
                            />
                        )}

                        <div className="custom-dialog-actions">
                            {dialogState.type !== 'alert' && (
                                <button className="custom-dialog-button cancel" onClick={handleCancel}>
                                    {dialogState.cancelText || 'Отмена'}
                                </button>
                            )}
                            <button className={`custom-dialog-button confirm ${dialogState.type === 'alert' ? 'alert-only' : ''}`} onClick={handleConfirm}>
                                {dialogState.confirmText || 'ОК'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DialogContext.Provider>
    );
};
