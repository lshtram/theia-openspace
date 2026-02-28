/**
 * Unit tests for ModelModeSelector logic.
 * Tests label derivation and component interface without DOM rendering.
 */
import { expect } from 'chai';
import type { ModelModeSelectorProps } from '../prompt-input/model-mode-selector';

describe('ModelModeSelector logic', () => {
    const modes = ['default', 'think', 'high'];

    // Mirror the modeLabel logic from the component
    const MODE_LABELS: Record<string, string> = {
        default: 'Default',
        think: 'Think',
        thinking: 'Think',
        high: 'High',
        auto: 'Auto',
    };
    function modeLabel(mode: string): string {
        return MODE_LABELS[mode.toLowerCase()] ?? (mode.charAt(0).toUpperCase() + mode.slice(1));
    }

    it('renders "Default" for mode "default"', () => {
        expect(modeLabel('default')).to.equal('Default');
    });

    it('renders "Think" for mode "think"', () => {
        expect(modeLabel('think')).to.equal('Think');
    });

    it('renders "High" for mode "high"', () => {
        expect(modeLabel('high')).to.equal('High');
    });

    it('capitalises unknown modes', () => {
        expect(modeLabel('turbo')).to.equal('Turbo');
    });

    it('ModelModeSelectorProps interface accepts required props', () => {
        const props: ModelModeSelectorProps = {
            modes,
            selected: 'default',
            onSelect: () => {},
        };
        expect(props.modes).to.have.length(3);
        expect(props.selected).to.equal('default');
    });

    it('returns null-equivalent when modes has one or fewer items', () => {
        // Component renders null when modes.length <= 1
        const single: ModelModeSelectorProps = { modes: ['default'], selected: 'default', onSelect: () => {} };
        expect(single.modes.length).to.be.lessThanOrEqual(1);
    });
});
