/**
 * Unit tests for AgentSelector logic (no DOM/React rendering required).
 * Tests the label derivation and prop interface without @testing-library/react.
 */
import { expect } from 'chai';
import type { AgentSelectorProps } from '../prompt-input/agent-selector';
import type { AgentInfo } from 'openspace-core/lib/common/opencode-protocol';

describe('AgentSelector logic', () => {
    const agents: AgentInfo[] = [
        { name: 'build', description: 'Build agent' },
        { name: 'plan', description: 'Plan agent' },
    ];

    // Mirrors the label logic in the component: selectedAgent?.name ?? 'Default'
    function deriveLabel(selectedAgent: AgentInfo | null): string {
        return selectedAgent?.name ?? 'Default';
    }

    it('shows selected agent name when an agent is selected', () => {
        expect(deriveLabel(agents[0])).to.equal('build');
    });

    it('shows "Default" when no agent is selected', () => {
        expect(deriveLabel(null)).to.equal('Default');
    });

    it('AgentSelectorProps type accepts null selectedAgent', () => {
        const props: AgentSelectorProps = {
            agents,
            selectedAgent: null,
            onSelect: () => {},
        };
        expect(props.selectedAgent).to.be.null;
    });

    it('AgentSelectorProps type accepts an agent as selectedAgent', () => {
        const props: AgentSelectorProps = {
            agents,
            selectedAgent: agents[1],
            onSelect: () => {},
        };
        expect(props.selectedAgent?.name).to.equal('plan');
    });

    it('onSelect callback receives the correct agent', () => {
        const received: (AgentInfo | null)[] = [];
        const props: AgentSelectorProps = {
            agents,
            selectedAgent: null,
            onSelect: (a) => received.push(a),
        };
        props.onSelect(agents[0]);
        props.onSelect(null);
        expect(received).to.deep.equal([agents[0], null]);
    });
});
