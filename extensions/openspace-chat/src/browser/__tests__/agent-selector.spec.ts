/**
 * Tests for AgentSelector component.
 */
import * as React from '@theia/core/shared/react';
import { expect } from 'chai';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgentSelector } from '../prompt-input/agent-selector';

describe('AgentSelector', () => {
    const agents = [
        { name: 'build', description: 'Build agent' },
        { name: 'plan', description: 'Plan agent' },
    ];

    it('renders the selected agent name', () => {
        render(React.createElement(AgentSelector, { agents, selectedAgent: agents[0], onSelect: () => {} }));
        expect(screen.getByRole('button').textContent).to.include('build');
    });

    it('renders "Default" when no agent selected', () => {
        render(React.createElement(AgentSelector, { agents, selectedAgent: null, onSelect: () => {} }));
        expect(screen.getByRole('button').textContent).to.include('Default');
    });

    it('opens dropdown on click', () => {
        render(React.createElement(AgentSelector, { agents, selectedAgent: null, onSelect: () => {} }));
        fireEvent.click(screen.getByRole('button'));
        expect(document.querySelector('.agent-selector-dropdown')).to.not.be.null;
    });

    it('calls onSelect with null when Default is clicked', () => {
        const selections: (typeof agents[0] | null)[] = [];
        render(React.createElement(AgentSelector, { agents, selectedAgent: agents[0], onSelect: (a) => selections.push(a) }));
        fireEvent.click(screen.getByRole('button')); // open
        const options = document.querySelectorAll('.agent-selector-option');
        fireEvent.click(options[0]); // Default
        expect(selections[0]).to.be.null;
    });

    it('calls onSelect with agent when agent option is clicked', () => {
        const selections: (typeof agents[0] | null)[] = [];
        render(React.createElement(AgentSelector, { agents, selectedAgent: null, onSelect: (a) => selections.push(a) }));
        fireEvent.click(screen.getByRole('button')); // open
        const options = document.querySelectorAll('.agent-selector-option');
        fireEvent.click(options[1]); // build agent
        expect(selections[0]).to.deep.equal(agents[0]);
    });
});
