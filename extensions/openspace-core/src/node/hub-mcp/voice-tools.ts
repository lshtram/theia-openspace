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

import { z } from 'zod';
import { TOOL } from '../../common/tool-names';
import type { IMcpServer, BridgeDeps } from './types';

export function registerVoiceTools(server: IMcpServer, deps: BridgeDeps): void {
    server.tool(
        TOOL.VOICE_SET_POLICY,
        'Update the voice modality policy. Use this to enable/disable voice, change narration mode, speed, or voice ID.',
        {
            enabled: z.boolean().optional().describe('Enable or disable voice input and narration'),
            narrationMode: z.enum(['narrate-off', 'narrate-everything', 'narrate-summary']).optional()
                .describe('Narration mode: narrate-off disables TTS, narrate-everything reads all responses, narrate-summary reads a concise summary'),
            speed: z.number().min(0.5).max(2.0).optional().describe('TTS speed multiplier (0.5–2.0, default 1.0)'),
            voice: z.string().optional().describe('TTS voice ID (e.g. af_sarah, af_bella)'),
            narrationPrompts: z.object({
                everything: z.string().optional().describe('Override the "narrate-everything" LLM preprocessing prompt'),
                summary: z.string().optional().describe('Override the "narrate-summary" LLM preprocessing prompt'),
            }).optional().describe('Override narration preprocessing prompts'),
        },
        async (args: Record<string, unknown>) => deps.executeViaBridge(TOOL.VOICE_SET_POLICY, args)
    );
}
