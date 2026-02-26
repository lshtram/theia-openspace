import * as React from '@theia/core/shared/react';

export interface FileDiff {
    filename: string;
    oldContent: string;
    newContent: string;
}

export interface ReviewPanelProps {
    diffs: FileDiff[];
    onClose: () => void;
}

export const ReviewPanel: React.FC<ReviewPanelProps> = ({ diffs, onClose }) => {
    const [selectedIndex, setSelectedIndex] = React.useState<number | null>(
        diffs.length > 0 ? 0 : null
    );

    const selectedDiff = selectedIndex !== null ? diffs[selectedIndex] : null;

    return (
        <div className="review-panel">
            <div className="review-panel-header">
                <span className="review-panel-title">Review Changes</span>
                <button className="review-panel-close" onClick={onClose} aria-label="Close">×</button>
            </div>
            <div className="review-panel-body">
                <div className="review-file-list">
                    {diffs.length === 0 ? (
                        <div className="review-empty-state">No changes to review</div>
                    ) : (
                        diffs.map((diff, i) => (
                            <div
                                key={diff.filename}
                                className={`review-file-item${selectedIndex === i ? ' review-file-item--active' : ''}`}
                                onClick={() => setSelectedIndex(i)}
                            >
                                {diff.filename}
                            </div>
                        ))
                    )}
                </div>
                {selectedDiff && (
                    <div className="review-diff-view">
                        <pre className="review-diff-content">{selectedDiff.newContent}</pre>
                    </div>
                )}
            </div>
        </div>
    );
};
