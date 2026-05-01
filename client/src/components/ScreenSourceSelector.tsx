import React, { useState, useEffect, useCallback, memo } from 'react';
import ReactDOM from 'react-dom';
import './ScreenSourceSelector.css';

const SourceItem = memo(({ source, isSelected, onSelect, onDoubleClick, resolution, frameRate, videoCodec }: any) => {
    return (
        <div
            className={`source-item ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelect(source.id)}
            onDoubleClick={() => onDoubleClick(source.id, { withAudio: true, resolution, frameRate, videoCodec })}
        >
            <div className="source-thumbnail-container">
                <img src={source.thumbnail} alt={source.name} className="source-thumbnail" loading="lazy" />
                <div className="source-thumbnail-overlay"></div>
            </div>
            <div className="source-info">
                {source.appIcon ? (
                    <div className="source-app-icon">
                        <img src={source.appIcon} alt="" />
                    </div>
                ) : (
                    <div className="source-app-icon placeholder"></div>
                )}
                <span className="source-name">{source.name}</span>
            </div>
        </div>
    );
});

interface DesktopSource {
    id: string;
    name: string;
    thumbnail: string;
    display_id: string;
    appIcon: string | null;
}

interface ScreenSourceSelectorProps {
    onSelect: (sourceId: string, options: { withAudio: boolean, resolution: string, frameRate: string, videoCodec: 'av1' | 'vp9' | 'h264' }) => void;
    onClose: () => void;
}

const ScreenSourceSelector: React.FC<ScreenSourceSelectorProps> = ({ onSelect, onClose }) => {
    const [sources, setSources] = useState<DesktopSource[]>([]);
    const [selectedTab, setSelectedTab] = useState<'screen' | 'window'>('screen');
    const [loading, setLoading] = useState(true);
    const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
    const [resolution, setResolution] = useState('720');
    const [frameRate, setFrameRate] = useState('30');
    const [videoCodec, setVideoCodec] = useState<'av1' | 'vp9' | 'h264'>('vp9');

    useEffect(() => {
        let isMounted = true;
        let timeoutId: any;

        const fetchSources = async () => {
            const electron = (window as any).electron;
            if (!electron || !electron.getDesktopSources) return;

            try {
                const types = selectedTab === 'screen' ? ['screen'] : ['window'];
                const results = await electron.getDesktopSources({
                    types,
                    thumbnailSize: { width: 150, height: 85 }
                });
                if (isMounted) {
                    setSources(results);
                    setLoading(false);
                }
            } catch (err) {
                console.error('Failed to get sources:', err);
                if (isMounted) setLoading(false);
            }
            
            if (isMounted) timeoutId = setTimeout(fetchSources, 8000);
        };

        fetchSources();
        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
        };
    }, [selectedTab]);

    const handleSelect = () => {
        if (selectedSourceId) {
            // Screen sharing on Windows: 
            // Entire screen usually carries system audio.
            // Individual windows usually don't carry audio unless it's a browser tab (not common for Electron yet).
            // However, we will pass true for withAudio and handle it in the provider.
            onSelect(selectedSourceId, { withAudio: true, resolution, frameRate, videoCodec });
        }
    };

    return ReactDOM.createPortal(
        <div className="screen-source-selector-overlay" onClick={onClose}>
            <div className="screen-source-selector-modal" onClick={e => e.stopPropagation()}>
                <div className="screen-source-selector-header">
                    <h2>Выберите, что транслировать</h2>
                    <button className="close-button" onClick={onClose}>&times;</button>
                </div>

                <div className="screen-source-tabs">
                    <button
                        className={`tab-button ${selectedTab === 'screen' ? 'active' : ''}`}
                        onClick={() => setSelectedTab('screen')}
                    >
                        Экраны
                    </button>
                    <button
                        className={`tab-button ${selectedTab === 'window' ? 'active' : ''}`}
                        onClick={() => setSelectedTab('window')}
                    >
                        Приложения
                    </button>
                </div>

                <div className="screen-quality-settings">
                    <div className="quality-section">
                        <div className="quality-label">Разрешение</div>
                        <div className="quality-options">
                            {['480', '720', '1080', '1440', '2160'].map(res => (
                                <button
                                    key={res}
                                    className={`quality-option ${resolution === res ? 'active' : ''}`}
                                    onClick={() => setResolution(res)}
                                >
                                    {res === '2160' ? '4K' : res === '1440' ? '2K' : res + 'p'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="quality-section">
                        <div className="quality-label">Частота кадров</div>
                        <div className="quality-options">
                            {['15', '30', '60', '120'].map(fps => (
                                <button
                                    key={fps}
                                    className={`quality-option ${frameRate === fps ? 'active' : ''}`}
                                    onClick={() => setFrameRate(fps)}
                                >
                                    {fps} FPS
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="quality-section">
                        <div className="quality-label">Кодек</div>
                        <div className="quality-options">
                            {['av1', 'vp9', 'h264'].map(codec => (
                                <button
                                    key={codec}
                                    className={`quality-option ${videoCodec === codec ? 'active' : ''}`}
                                    onClick={() => setVideoCodec(codec as any)}
                                >
                                    {codec.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="screen-source-selector-content">
                    {loading && sources.length === 0 ? (
                        <div className="screen-source-selector-loading">
                            <div className="loading-spinner"></div>
                            <p>Загрузка источников...</p>
                        </div>
                    ) : sources.length === 0 ? (
                        <div className="no-sources">
                            <p>Источники не найдены</p>
                        </div>
                    ) : (
                        <div className="sources-grid">
                            {sources.map(source => (
                                <SourceItem
                                    key={source.id}
                                    source={source}
                                    isSelected={selectedSourceId === source.id}
                                    onSelect={setSelectedSourceId}
                                    onDoubleClick={onSelect}
                                    resolution={resolution}
                                    frameRate={frameRate}
                                    videoCodec={videoCodec}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <div className="screen-source-selector-footer">
                    <button className="cancel-button" onClick={onClose}>Отмена</button>
                    <button
                        className="select-button"
                        disabled={!selectedSourceId}
                        onClick={handleSelect}
                    >
                        Прямой эфир
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ScreenSourceSelector;
