/********************************************************************************
 * Copyright (C) 2024 OpenSpace contributors.
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
 ********************************************************************************/
import { injectable } from '@theia/core/shared/inversify';
import { ColorContribution } from '@theia/core/lib/browser/color-application-contribution';
import { ColorRegistry } from '@theia/core/lib/browser/color-registry';

@injectable()
export class OpenspaceChatColorContribution implements ColorContribution {
    registerColors(colors: ColorRegistry): void {
        colors.register(
            {
                id: 'openspace.chat.background',
                defaults: { light: '#ffffff', dark: '#1e1e1e', hcDark: '#000000', hcLight: '#ffffff' },
                description: 'OpenSpace Chat: main background'
            },
            {
                id: 'openspace.chat.backgroundRaised',
                defaults: { light: '#f3f3f3', dark: '#252526', hcDark: '#000000', hcLight: '#f3f3f3' },
                description: 'OpenSpace Chat: raised surface (header, footer, panels)'
            },
            {
                id: 'openspace.chat.backgroundInput',
                defaults: { light: '#ffffff', dark: '#2d2d2d', hcDark: '#000000', hcLight: '#ffffff' },
                description: 'OpenSpace Chat: input field background'
            },
            {
                id: 'openspace.chat.backgroundHover',
                defaults: { light: '#e8e8e8', dark: '#2a2d2e', hcDark: '#2a2d2e', hcLight: '#e8e8e8' },
                description: 'OpenSpace Chat: hover background'
            },
            {
                id: 'openspace.chat.backgroundCode',
                defaults: { light: '#f5f5f5', dark: '#1e1e1e', hcDark: '#000000', hcLight: '#f5f5f5' },
                description: 'OpenSpace Chat: code block background'
            },
            {
                id: 'openspace.chat.border',
                defaults: { light: '#d4d4d4', dark: '#333333', hcDark: '#6fc3df', hcLight: '#0f4a85' },
                description: 'OpenSpace Chat: panel border'
            },
            {
                id: 'openspace.chat.borderFocus',
                defaults: { light: '#0078d4', dark: '#007acc', hcDark: '#f38518', hcLight: '#0078d4' },
                description: 'OpenSpace Chat: focus ring'
            },
            {
                id: 'openspace.chat.foreground',
                defaults: { light: '#383838', dark: '#cccccc', hcDark: '#ffffff', hcLight: '#000000' },
                description: 'OpenSpace Chat: primary text'
            },
            {
                id: 'openspace.chat.foregroundDim',
                defaults: { light: '#717171', dark: '#858585', hcDark: '#a0a0a0', hcLight: '#595959' },
                description: 'OpenSpace Chat: muted/secondary text'
            },
            {
                id: 'openspace.chat.foregroundBright',
                defaults: { light: '#000000', dark: '#ffffff', hcDark: '#ffffff', hcLight: '#000000' },
                description: 'OpenSpace Chat: emphasis text'
            },
            {
                id: 'openspace.chat.accent',
                defaults: { light: '#0078d4', dark: '#007acc', hcDark: '#f38518', hcLight: '#0078d4' },
                description: 'OpenSpace Chat: accent/button color'
            },
            {
                id: 'openspace.chat.accentHover',
                defaults: { light: '#0069bd', dark: '#1f8ad2', hcDark: '#f38518', hcLight: '#0069bd' },
                description: 'OpenSpace Chat: accent hover'
            },
            {
                id: 'openspace.chat.terminalGreen',
                defaults: { light: '#116329', dark: '#4ec94e', hcDark: '#89d185', hcLight: '#116329' },
                description: 'OpenSpace Chat: terminal success / bash output color'
            },
            {
                id: 'openspace.chat.pillBackground',
                defaults: { light: 'rgba(0,0,0,0.05)', dark: 'rgba(255,255,255,0.06)', hcDark: 'rgba(255,255,255,0.1)', hcLight: 'rgba(0,0,0,0.08)' },
                description: 'OpenSpace Chat: pill/chip background'
            },
            {
                id: 'openspace.chat.pillBorder',
                defaults: { light: 'rgba(0,0,0,0.12)', dark: 'rgba(255,255,255,0.10)', hcDark: 'rgba(255,255,255,0.2)', hcLight: 'rgba(0,0,0,0.2)' },
                description: 'OpenSpace Chat: pill/chip border'
            },
            {
                id: 'openspace.chat.userBubbleBackground',
                defaults: { light: '#dce8f8', dark: '#333333', hcDark: '#1a1a2e', hcLight: '#dce8f8' },
                description: 'OpenSpace Chat: user message bubble background'
            },
            {
                id: 'openspace.chat.userBubbleForeground',
                defaults: { light: '#1a1a1a', dark: '#ffffff', hcDark: '#ffffff', hcLight: '#000000' },
                description: 'OpenSpace Chat: user message bubble text'
            },
            {
                id: 'openspace.chat.userBubbleBorder',
                defaults: { light: '#b8d0ef', dark: 'transparent', hcDark: '#6fc3df', hcLight: '#0078d4' },
                description: 'OpenSpace Chat: user message bubble border'
            },
            {
                id: 'openspace.chat.bashBackground',
                defaults: { light: '#f0f4f0', dark: '#000000', hcDark: '#000000', hcLight: '#f0f4f0' },
                description: 'OpenSpace Chat: bash/terminal block background'
            },
            {
                id: 'openspace.chat.bashBorder',
                defaults: { light: '#c8dac8', dark: '#333333', hcDark: '#6fc3df', hcLight: '#c8dac8' },
                description: 'OpenSpace Chat: bash/terminal block border'
            },
            {
                id: 'openspace.chat.reasoningBorder',
                defaults: { light: '#c0c0c0', dark: '#333333', hcDark: '#a0a0a0', hcLight: '#c0c0c0' },
                description: 'OpenSpace Chat: reasoning/thinking block left border'
            },
            {
                id: 'openspace.chat.shimmerStart',
                defaults: { light: '#c0c0c0', dark: '#333333', hcDark: '#555555', hcLight: '#c0c0c0' },
                description: 'OpenSpace Chat: shimmer animation start color'
            },
            {
                id: 'openspace.chat.shimmerMid',
                defaults: { light: '#888888', dark: '#666666', hcDark: '#aaaaaa', hcLight: '#888888' },
                description: 'OpenSpace Chat: shimmer animation mid color'
            },
            {
                id: 'openspace.chat.sessionActiveBackground',
                defaults: { light: '#dce8f8', dark: 'rgba(255,255,255,0.04)', hcDark: 'rgba(255,255,255,0.1)', hcLight: '#dce8f8' },
                description: 'OpenSpace Chat: active session row background in tree'
            },
            {
                id: 'openspace.chat.sessionActiveForeground',
                defaults: { light: '#0a4a7a', dark: '#ffffff', hcDark: '#ffffff', hcLight: '#0a4a7a' },
                description: 'OpenSpace Chat: active session row text in tree'
            }
        );
    }
}
