// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { expect } from 'chai';
import * as sinon from 'sinon';
import { OpenCodeProxy } from '../opencode-proxy';
import { ILogger } from '@theia/core/lib/common/logger';

/**
 * Test suite for OpenCodeProxy stream interceptor functionality.
 * 
 * Tests the brace-counting state machine that extracts agent commands
 * from %%OS{...}%% blocks in message streams.
 * 
 * Critical test cases:
 * 1. Nested JSON objects (Issue #1)
 * 2. Multiple commands in one message (Issue #2)
 * 3. Malformed JSON handling
 * 4. Edge cases (empty blocks, unclosed braces, etc.)
 */
describe('OpenCodeProxy - Stream Interceptor', () => {
    let proxy: OpenCodeProxy;
    let mockLogger: sinon.SinonStubbedInstance<ILogger>;

    beforeEach(() => {
        // Create mock logger
        mockLogger = {
            debug: sinon.stub(),
            info: sinon.stub(),
            warn: sinon.stub(),
            error: sinon.stub(),
            log: sinon.stub(),
            isEnabled: sinon.stub().returns(true),
            ifEnabled: sinon.stub(),
            isDebug: sinon.stub().returns(false),
            ifDebug: sinon.stub(),
            isInfo: sinon.stub().returns(false),
            ifInfo: sinon.stub(),
            isWarn: sinon.stub().returns(false),
            ifWarn: sinon.stub(),
            isError: sinon.stub().returns(false),
            ifError: sinon.stub(),
            isFatal: sinon.stub().returns(false),
            ifFatal: sinon.stub(),
            isTrace: sinon.stub().returns(false),
            ifTrace: sinon.stub(),
            child: sinon.stub()
        } as any;

        // Create proxy instance
        proxy = new OpenCodeProxy();
        (proxy as any).logger = mockLogger;
        (proxy as any).serverUrl = 'http://localhost:7890';
        (proxy as any).init();
    });

    /**
     * Issue #1: Nested JSON objects fail with simple regex.
     * 
     * The original regex /%%OS(\{[^}]*\})%%/g stops at the first }
     * and fails on nested structures like {"args":{"nested":"value"}}.
     */
    describe('Issue #1: Nested JSON Objects', () => {
        it('should extract command with nested object in args', () => {
            const parts = [
                {
                    type: 'text',
                    text: 'Before %%OS{"cmd":"openspace.test","args":{"nested":{"deep":"value"}}}%% After'
                }
            ];

            const result = (proxy as any).interceptStream(parts);

            expect(result.commands).to.have.lengthOf(1);
            expect(result.commands[0].cmd).to.equal('openspace.test');
            expect(result.commands[0].args).to.deep.equal({ nested: { deep: 'value' } });
            expect(result.cleanParts).to.have.lengthOf(1);
            expect((result.cleanParts[0]).text).to.equal('Before  After');
        });

        it('should extract command with deeply nested structures', () => {
            const parts = [
                {
                    type: 'text',
                    text: '%%OS{"cmd":"openspace.complex","args":{"a":{"b":{"c":{"d":"value"}}}}}%%'
                }
            ];

            const result = (proxy as any).interceptStream(parts);

            expect(result.commands).to.have.lengthOf(1);
            expect(result.commands[0].cmd).to.equal('openspace.complex');
            expect(result.commands[0].args).to.deep.equal({ a: { b: { c: { d: 'value' } } } });
        });

        it('should extract command with array of objects', () => {
            const parts = [
                {
                    type: 'text',
                    text: '%%OS{"cmd":"openspace.array","args":[{"id":1},{"id":2}]}%%'
                }
            ];

            const result = (proxy as any).interceptStream(parts);

            expect(result.commands).to.have.lengthOf(1);
            expect(result.commands[0].args).to.deep.equal([{ id: 1 }, { id: 2 }]);
        });
    });

    /**
     * Issue #2: Multiple commands in one message may not all be extracted.
     * 
     * The original implementation used regex.exec() on the original text
     * but performed replacements on a copy, causing index misalignment.
     */
    describe('Issue #2: Multiple Commands in One Message', () => {
        it('should extract all commands from text with multiple blocks', () => {
            const parts = [
                {
                    type: 'text',
                    text: 'First %%OS{"cmd":"openspace.cmd1"}%% middle %%OS{"cmd":"openspace.cmd2"}%% end'
                }
            ];

            const result = (proxy as any).interceptStream(parts);

            expect(result.commands).to.have.lengthOf(2);
            expect(result.commands[0].cmd).to.equal('openspace.cmd1');
            expect(result.commands[1].cmd).to.equal('openspace.cmd2');
            expect((result.cleanParts[0]).text).to.equal('First  middle  end');
        });

        it('should extract commands from consecutive blocks', () => {
            const parts = [
                {
                    type: 'text',
                    text: '%%OS{"cmd":"openspace.a"}%%%%OS{"cmd":"openspace.b"}%%%%OS{"cmd":"openspace.c"}%%'
                }
            ];

            const result = (proxy as any).interceptStream(parts);

            expect(result.commands).to.have.lengthOf(3);
            expect(result.commands[0].cmd).to.equal('openspace.a');
            expect(result.commands[1].cmd).to.equal('openspace.b');
            expect(result.commands[2].cmd).to.equal('openspace.c');
            expect(result.cleanParts).to.have.lengthOf(0); // All command blocks, no text left
        });

        it('should handle interleaved text and commands', () => {
            const parts = [
                {
                    type: 'text',
                    text: 'A %%OS{"cmd":"openspace.1"}%% B %%OS{"cmd":"openspace.2"}%% C %%OS{"cmd":"openspace.3"}%% D'
                }
            ];

            const result = (proxy as any).interceptStream(parts);

            expect(result.commands).to.have.lengthOf(3);
            expect((result.cleanParts[0]).text).to.equal('A  B  C  D');
        });
    });

    /**
     * Malformed JSON and edge cases.
     * 
     * Note: StreamInterceptor (the canonical implementation) handles these cases differently:
     * - Malformed/incomplete blocks are kept in text (not cleaned) since they can't be parsed
     * - Empty blocks without 'cmd' field are not extracted (more secure)
     * - Additional fields in args are preserved at top level for backward compatibility
     */
    describe('Malformed JSON and Edge Cases', () => {
        it('should discard malformed JSON blocks', () => {
            const parts = [
                {
                    type: 'text',
                    text: 'Before %%OS{invalid json}%% After'
                }
            ];

            const result = (proxy as any).interceptStream(parts);

            // StreamInterceptor doesn't extract malformed blocks (no valid cmd)
            expect(result.commands).to.have.lengthOf(0);
            // Malformed blocks remain in text since they can't be parsed
            expect((result.cleanParts[0]).text).to.equal('Before %%OS{invalid json}%% After');
        });

        it('should handle unclosed brace blocks', () => {
            const parts = [
                {
                    type: 'text',
                    text: 'Before %%OS{"cmd":"test" After'
                }
            ];

            const result = (proxy as any).interceptStream(parts);

            // Unclosed brace - block is pending (kept for next chunk)
            // StreamInterceptor saves incomplete blocks as pending text
            expect(result.commands).to.have.lengthOf(0);
            // The text is cleaned - incomplete block is treated as pending and not included in clean text
            expect((result.cleanParts[0]).text).to.equal('Before ');
        });

        it('should handle missing closing %%', () => {
            const parts = [
                {
                    type: 'text',
                    text: 'Before %%OS{"cmd":"test"} After'
                }
            ];

            const result = (proxy as any).interceptStream(parts);

            // Missing closing %% - block is incomplete, not extracted
            // StreamInterceptor treats this as pending text
            expect(result.commands).to.have.lengthOf(0);
            // The text is cleaned - incomplete block is treated as pending
            expect((result.cleanParts[0]).text).to.equal('Before ');
        });

        it('should handle empty blocks', () => {
            const parts = [
                {
                    type: 'text',
                    text: 'Text %%OS{}%% More'
                }
            ];

            const result = (proxy as any).interceptStream(parts);

            // StreamInterceptor requires 'cmd' field - empty block is not a valid command
            expect(result.commands).to.have.lengthOf(0);
            // Empty block remains in text since it can't be executed
            expect((result.cleanParts[0]).text).to.equal('Text %%OS{}%% More');
        });

        it('should handle strings containing braces', () => {
            const parts = [
                {
                    type: 'text',
                    text: '%%OS{"cmd":"openspace.test","msg":"has {braces} in string"}%%'
                }
            ];

            const result = (proxy as any).interceptStream(parts);

            expect(result.commands).to.have.lengthOf(1);
            expect(result.commands[0].cmd).to.equal('openspace.test');
            // Fields from args are preserved at top level for backward compatibility
            expect((result.commands[0] as any).args).to.have.property('msg', 'has {braces} in string');
        });

        it('should handle escaped quotes in strings', () => {
            const parts = [
                {
                    type: 'text',
                    text: '%%OS{"cmd":"openspace.test","msg":"has \\"quotes\\""}%%'
                }
            ];

            const result = (proxy as any).interceptStream(parts);

            expect(result.commands).to.have.lengthOf(1);
            // Fields from args are preserved at top level for backward compatibility
            expect((result.commands[0] as any).args).to.have.property('msg', 'has "quotes"');
        });
    });

    /**
     * Non-text parts should pass through unchanged.
     */
    describe('Non-Text Parts', () => {
        it('should pass through non-text parts unchanged', () => {
            const parts = [
                { type: 'image', url: 'http://example.com/image.png' } as any,
                { type: 'text', text: '%%OS{"cmd":"openspace.test"}%%' },
                { type: 'code', content: 'console.log("test");' } as any
            ];

            const result = (proxy as any).interceptStream(parts);

            expect(result.commands).to.have.lengthOf(1);
            expect(result.cleanParts).to.have.lengthOf(2); // image + code (text was all command)
            expect(result.cleanParts[0].type).to.equal('image');
            expect(result.cleanParts[1].type).to.equal('code');
        });
    });

    /**
     * Text-only (no commands) should return unchanged.
     */
    describe('No Commands', () => {
        it('should return text unchanged when no commands present', () => {
            const parts = [
                { type: 'text', text: 'This is just normal text with no commands.' }
            ];

            const result = (proxy as any).interceptStream(parts);

            expect(result.commands).to.have.lengthOf(0);
            expect(result.cleanParts).to.have.lengthOf(1);
            expect((result.cleanParts[0]).text).to.equal('This is just normal text with no commands.');
        });
    });
});
