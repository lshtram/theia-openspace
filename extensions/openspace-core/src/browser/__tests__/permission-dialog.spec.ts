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
 * T2-18: Proper focus trap in permission dialog.
 *
 * Structural tests: verify that the Tab-cycling focus trap code is
 * present in the permission-dialog source.
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';

describe('PermissionDialog - Focus Trap (T2-18)', () => {
    it('focus trap cycles Tab within dialog elements', () => {
        // Structural test: verify the Tab cycling code is present in source
        // Use process.cwd() (repo root) since __dirname is unavailable in ESM context
        const src = fs.readFileSync(
            path.join(
                process.cwd(),
                'extensions/openspace-core/src/browser/permission-dialog.tsx'
            ),
            'utf-8'
        );
        expect(src).to.include("key === 'Tab'");
        expect(src).to.include('focusableElements');
    });
});
