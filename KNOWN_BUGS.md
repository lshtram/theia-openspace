## Known Bugs

### Terminal Process Leak (HIGH PRIORITY)
- **Issue**: zsh processes are not cleaned up when terminals are closed in Theia
- **Impact**: Each terminal session leaves behind orphaned shell processes
- **Reproduction**: Open multiple terminals in Theia, close them, check with: `ps -o pid,ppid,etime,comm -ax | grep /bin/zsh`
- **Root cause**: Unknown - likely in Theia's terminal-widget-impl.ts dispose/close logic
- **Workaround**: Restart Theia periodically, or manually kill orphaned processes


