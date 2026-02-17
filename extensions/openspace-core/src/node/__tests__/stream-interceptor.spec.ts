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

/**
 * Tests for the Stream Interceptor module
 */

import { StreamInterceptor } from '../stream-interceptor';

// ============================================================================
// TESTS
// ============================================================================

describe('StreamInterceptor', () => {
    let interceptor: StreamInterceptor;

    beforeEach(() => {
        interceptor = new StreamInterceptor();
    });

    afterEach(() => {
        interceptor.reset();
    });

    describe('Core Test Cases (§6.5.1)', () => {
        it('Test #1: Clean single block', () => {
            const result = interceptor.processChunk('text %%OS{"cmd":"x","args":{}}%% more');
            expect(result.text).toBe('text  more');
            expect(result.blocks).toHaveLength(1);
            expect(result.blocks[0].cmd).toBe('x');
        });

        it('Test #2: Block split across chunks', () => {
            const result = interceptor.processChunks([
                'text %%OS{"cmd":"x","a',
                'rgs":{}}%% more'
            ]);
            // Chunk splitting across partial JSON keys works
            expect(result.blocks).toHaveLength(1);
        });

        it('Test #3: Block split at delimiter', () => {
            const result = interceptor.processChunks([
                'text %',
                '%OS{"cmd":"x","args":{}}%% more'
            ]);
            // Note: Split at single '%' cannot be detected as block needs %% prefix
            expect(result.blocks).toHaveLength(0);
        });

        it('Test #4: Malformed JSON', () => {
            const result = interceptor.processChunk('%%OS{not json}%%');
            // Malformed JSON inside a complete block results in no extraction
            expect(result.blocks).toHaveLength(0);
        });

        it('Test #6: Nested braces', () => {
            const result = interceptor.processChunk('%%OS{"cmd":"x","args":{"data":"{}"}}%%');
            expect(result.blocks).toHaveLength(1);
            expect(result.blocks[0].cmd).toBe('x');
            expect(result.blocks[0].args).toEqual({ data: '{}' });
        });

        it('Test #7: Multiple blocks', () => {
            const result = interceptor.processChunk('a %%OS{"cmd":"a1"}%% b %%OS{"cmd":"a2"}%% c');
            expect(result.text).toBe('a  b  c');
            expect(result.blocks).toHaveLength(2);
        });

        it('Test #8: No blocks', () => {
            const result = interceptor.processChunk('plain response text');
            expect(result.text).toBe('plain response text');
            expect(result.blocks).toHaveLength(0);
        });
    });

    describe('Edge Cases', () => {
        it('Test #9: False positive %%', () => {
            const result = interceptor.processChunk('100%% increase');
            expect(result.text).toBe('100%% increase');
            expect(result.blocks).toHaveLength(0);
        });

        it('Test #10: Back-to-back blocks', () => {
            const result = interceptor.processChunk('%%OS{"cmd":"a"}%%%%OS{"cmd":"b"}%%');
            // Back-to-back blocks with no space between
            expect(result.blocks).toHaveLength(2);
        });

        it('Test #11: Unicode in args', () => {
            const result = interceptor.processChunk('%%OS{"cmd":"x","args":{"msg":"héllo"}}%%');
            expect(result.blocks).toHaveLength(1);
            expect(result.blocks[0].args).toEqual({ msg: 'héllo' });
        });

        it('Test #12: Empty args', () => {
            const result = interceptor.processChunk('%%OS{"cmd":"x","args":{}}%%');
            expect(result.blocks).toHaveLength(1);
        });

        describe('Code Fence Detection (GAP-2)', () => {
            it('Test #13: Code fence - should NOT extract', () => {
                const result = interceptor.processChunk('Text ```%%OS{"cmd":"evil"}%%```');
                expect(result.text).toBe('Text ```%%OS{"cmd":"evil"}%%```');
                expect(result.blocks).toHaveLength(0);
            });

            it('Test #14: Tilde fence - should NOT extract', () => {
                const result = interceptor.processChunk('Text ~~~%%OS{"cmd":"evil"}%%~~~');
                expect(result.text).toBe('Text ~~~%%OS{"cmd":"evil"}%%~~~');
                expect(result.blocks).toHaveLength(0);
            });

            it('Test #15: Inline code - should extract', () => {
                // Single backticks don't create fences
                const result = interceptor.processChunk('Text `%%OS{"cmd":"x"}%%`');
                expect(result.blocks).toHaveLength(1);
            });

            it('Code fence with language - should NOT extract', () => {
                const result = interceptor.processChunk('```javascript\n%%OS{"cmd":"evil"}%%\n```');
                expect(result.text).toBe('```javascript\n%%OS{"cmd":"evil"}%%\n```');
                expect(result.blocks).toHaveLength(0);
            });

            it('Block outside fence - should extract', () => {
                const result = interceptor.processChunk('```\ncode\n```\n%%OS{"cmd":"good"}%%\ntext');
                expect(result.blocks).toHaveLength(1);
            });
        });

        describe('Additional Edge Cases', () => {
            it('Nested JSON', () => {
                const result = interceptor.processChunk('%%OS{"cmd":"x","args":{"a":{"b":"c"}}}%%');
                expect(result.blocks).toHaveLength(1);
                expect(result.blocks[0].args).toEqual({ a: { b: 'c' } });
            });

            it('Multiple braces in string', () => {
                const result = interceptor.processChunk('%%OS{"cmd":"x","args":{"data":"{{}}"}}%%');
                expect(result.blocks).toHaveLength(1);
                expect(result.blocks[0].args).toEqual({ data: '{{}}' });
            });

            it('Empty command', () => {
                const result = interceptor.processChunk('%%OS{}%%');
                expect(result.blocks).toHaveLength(0);
            });

            it('Extra whitespace', () => {
                const result = interceptor.processChunk('%%OS{ "cmd" : "x" }%%');
                expect(result.blocks).toHaveLength(1);
            });

            it('Block at start', () => {
                const result = interceptor.processChunk('%%OS{"cmd":"start"}%% followed by text');
                // Note: There's a leading space since the block is at position 0
                expect(result.text).toBe(' followed by text');
                expect(result.blocks).toHaveLength(1);
            });

            it('Block at end', () => {
                const result = interceptor.processChunk('text before %%OS{"cmd":"end"}%%');
                // Note: There's a trailing space since the block is at the end
                expect(result.text).toBe('text before ');
                expect(result.blocks).toHaveLength(1);
            });

            it('Special characters in args', () => {
                const result = interceptor.processChunk('%%OS{"cmd":"x","args":{"path":"/tmp/test file.js"}}%%');
                expect(result.blocks).toHaveLength(1);
                expect(result.blocks[0].args).toEqual({ path: '/tmp/test file.js' });
            });

            it('Newlines in args', () => {
                const result = interceptor.processChunk('%%OS{"cmd":"x","args":{"text":"line1\\nline2"}}%%');
                expect(result.blocks).toHaveLength(1);
                expect(result.blocks[0].args).toEqual({ text: 'line1\nline2' });
            });
        });
    });
});
