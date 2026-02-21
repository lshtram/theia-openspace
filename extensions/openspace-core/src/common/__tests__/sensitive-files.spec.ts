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
import { isSensitiveFile, matchesSensitivePattern, SENSITIVE_FILE_PATTERNS } from '../sensitive-files';

/**
 * Unit tests for shared sensitive-files module.
 * 
 * Test Coverage:
 * - Environment files (.env, .env.local, .env.production)
 * - Version control directories (.git/, git/)
 * - SSH keys (id_rsa, id_ed25519, etc.)
 * - Certificate and key files (*.pem, *.key)
 * - Cloud service credentials
 * - Configuration secrets
 * - Normal files should not be flagged
 */
describe('sensitive-files', () => {
    describe('isSensitiveFile', () => {
        describe('Environment files', () => {
            it('should detect .env file', () => {
                expect(isSensitiveFile('.env')).to.be.true;
            });

            it('should detect .env.local file', () => {
                expect(isSensitiveFile('.env.local')).to.be.true;
            });

            it('should detect .env.production file', () => {
                expect(isSensitiveFile('.env.production')).to.be.true;
            });

            it('should detect .env.development file', () => {
                expect(isSensitiveFile('.env.development')).to.be.true;
            });
        });

        describe('Version control', () => {
            it('should detect .git/config', () => {
                expect(isSensitiveFile('.git/config')).to.be.true;
            });

            it('should detect .git/credentials', () => {
                expect(isSensitiveFile('.git/credentials')).to.be.true;
            });

            it('should detect git/hooks', () => {
                expect(isSensitiveFile('git/hooks')).to.be.true;
            });
        });

        describe('SSH keys', () => {
            it('should detect id_rsa', () => {
                expect(isSensitiveFile('id_rsa')).to.be.true;
            });

            it('should detect id_rsa.pub', () => {
                expect(isSensitiveFile('id_rsa.pub')).to.be.true;
            });

            it('should detect id_ed25519', () => {
                expect(isSensitiveFile('id_ed25519')).to.be.true;
            });

            it('should detect id_dsa', () => {
                expect(isSensitiveFile('id_dsa')).to.be.true;
            });

            it('should detect id_ecdsa', () => {
                expect(isSensitiveFile('id_ecdsa')).to.be.true;
            });

            it('should detect .ssh/config', () => {
                expect(isSensitiveFile('.ssh/config')).to.be.true;
            });
        });

        describe('Certificates and keys', () => {
            it('should detect .pem files', () => {
                expect(isSensitiveFile('server.pem')).to.be.true;
                expect(isSensitiveFile('client.pem')).to.be.true;
            });

            it('should detect .key files', () => {
                expect(isSensitiveFile('private.key')).to.be.true;
                expect(isSensitiveFile('server.key')).to.be.true;
            });

            it('should detect .cert files', () => {
                expect(isSensitiveFile('server.cert')).to.be.true;
            });
        });

        describe('Cloud credentials', () => {
            it('should detect credentials.json', () => {
                expect(isSensitiveFile('credentials.json')).to.be.true;
            });

            it('should detect service-account.json', () => {
                expect(isSensitiveFile('service-account.json')).to.be.true;
            });

            it('should detect .aws/credentials', () => {
                expect(isSensitiveFile('.aws/credentials')).to.be.true;
            });

            it('should detect azure.json', () => {
                expect(isSensitiveFile('azure.json')).to.be.true;
            });

            it('should detect gcloud credentials', () => {
                expect(isSensitiveFile('gcloud/credentials')).to.be.true;
            });

            it('should detect firebase-adminsdk', () => {
                expect(isSensitiveFile('firebase-adminsdk.json')).to.be.true;
            });
        });

        describe('Configuration secrets', () => {
            it('should detect secrets.yml', () => {
                expect(isSensitiveFile('secrets.yml')).to.be.true;
            });

            it('should detect secrets.yaml', () => {
                expect(isSensitiveFile('secrets.yaml')).to.be.true;
            });

            it('should detect secrets.config', () => {
                expect(isSensitiveFile('secrets.config')).to.be.true;
            });

            it('should detect master.key', () => {
                expect(isSensitiveFile('master.key')).to.be.true;
            });

            it('should detect database.yml', () => {
                expect(isSensitiveFile('database.yml')).to.be.true;
            });

            it('should detect secrets directory and files', () => {
                expect(isSensitiveFile('secrets.yml')).to.be.true;     // already covered above
                expect(isSensitiveFile('.secrets')).to.be.true;        // hidden secrets dir
                expect(isSensitiveFile('config/secrets.json')).to.be.true;
            });
        });

        describe('Other sensitive files', () => {
            it('should detect .htpasswd', () => {
                expect(isSensitiveFile('.htpasswd')).to.be.true;
            });
        });

        describe('Normal files (should NOT be flagged)', () => {
            it('should allow regular source files', () => {
                expect(isSensitiveFile('src/index.ts')).to.be.false;
                expect(isSensitiveFile('src/main.js')).to.be.false;
            });

            it('should allow regular config files', () => {
                expect(isSensitiveFile('package.json')).to.be.false;
                expect(isSensitiveFile('tsconfig.json')).to.be.false;
            });

            it('should allow README files', () => {
                expect(isSensitiveFile('README.md')).to.be.false;
            });

            it('should allow .gitignore', () => {
                expect(isSensitiveFile('.gitignore')).to.be.false;
            });

            it('should allow regular text files', () => {
                expect(isSensitiveFile('notes.txt')).to.be.false;
                expect(isSensitiveFile('data.json')).to.be.false;
            });

            it('should NOT flag files with "secret" as substring (Task 15)', () => {
                expect(isSensitiveFile('src/secret-santa.ts')).to.be.false;
                expect(isSensitiveFile('app_secret.yml')).to.be.false;
                expect(isSensitiveFile('secretariat.ts')).to.be.false;
            });
        });
    });

    describe('matchesSensitivePattern', () => {
        it('should be an alias for isSensitiveFile', () => {
            expect(matchesSensitivePattern('.env')).to.equal(isSensitiveFile('.env'));
            expect(matchesSensitivePattern('src/index.ts')).to.equal(isSensitiveFile('src/index.ts'));
        });
    });

    describe('SENSITIVE_FILE_PATTERNS', () => {
        it('should contain at least 15 patterns', () => {
            // We expect at least 15 patterns based on the plan
            expect(SENSITIVE_FILE_PATTERNS.length).to.be.at.least(15);
        });

        it('should all be RegExp objects', () => {
            SENSITIVE_FILE_PATTERNS.forEach(pattern => {
                expect(pattern).to.be.instanceOf(RegExp);
            });
        });
    });
});
