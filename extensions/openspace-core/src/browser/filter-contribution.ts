// FilterContribution to hide Debug, SCM, and Notebook features from Theia IDE
import { injectable } from '@theia/core/shared/inversify';
import { FilterContribution, ContributionFilterRegistry } from '@theia/core/lib/common/contribution-filter';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { TabBarToolbarContribution } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { CommandContribution } from '@theia/core/lib/common/command';
import { MenuContribution } from '@theia/core/lib/common/menu';
import { KeybindingContribution } from '@theia/core/lib/browser/keybinding';
import { ColorContribution } from '@theia/core/lib/browser/color-application-contribution';

@injectable()
export class OpenSpaceFilterContribution implements FilterContribution {
    registerContributionFilters(registry: ContributionFilterRegistry): void {
        // Filter out Debug-related contributions
        registry.addFilters([FrontendApplicationContribution], [
            contrib => !this.isDebugContribution(contrib)
        ]);
        
        registry.addFilters([TabBarToolbarContribution], [
            contrib => !this.isDebugContribution(contrib) && !this.isScmContribution(contrib)
        ]);
        
        registry.addFilters([CommandContribution], [
            contrib => !this.isDebugContribution(contrib) && !this.isScmContribution(contrib)
        ]);
        
        registry.addFilters([MenuContribution], [
            contrib => !this.isDebugContribution(contrib) && !this.isScmContribution(contrib)
        ]);
        
        registry.addFilters([KeybindingContribution], [
            contrib => !this.isDebugContribution(contrib) && !this.isScmContribution(contrib)
        ]);
        
        registry.addFilters([ColorContribution], [
            contrib => !this.isDebugContribution(contrib) && !this.isScmContribution(contrib)
        ]);
        
        // Generic filter to catch any other debug/scm contributions
        registry.addFilters('*', [
            contrib => {
                // Filter by checking constructor name (works across webpack bundles)
                if (this.isDebugContribution(contrib) || this.isScmContribution(contrib)) {
                    const ctor = (contrib as { constructor?: { name?: string } }).constructor;
                    const name = ctor?.name;
                    if (process.env.NODE_ENV !== 'production') { console.log('[OpenSpaceFilter] Filtering out contribution:', name); }
                    return false;
                }
                return true;
            }
        ]);
    }
    
    private isDebugContribution(contrib: unknown): boolean {
        if (!contrib || typeof contrib !== 'object') { return false; }
        // Use constructor name check - use partial match for "Debug"
        const ctor = (contrib as { constructor?: { name?: string } }).constructor;
        const name = ctor?.name || '';
        
        // Filter any contribution with "Debug" in the name
        return name.includes('Debug');
    }
    
    private isScmContribution(contrib: unknown): boolean {
        if (!contrib || typeof contrib !== 'object') { return false; }
        const ctor = (contrib as { constructor?: { name?: string } }).constructor;
        const name = ctor?.name || '';
        
        // Filter any contribution with "Scm" or "Git" in the name
        return name.includes('Scm') || name.includes('Git') || name.includes('git');
    }
}
