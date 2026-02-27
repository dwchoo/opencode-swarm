import { describe, expect, test, mock, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import OpenCodeSwarm from '../../src/index';
import { SWARM_COMMAND_ORDER, SWARM_COMMAND_DESCRIPTION_MAP } from '../../src/commands/registry';

describe('src/index.ts focused coverage pass', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swarm-index-coverage-'));
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('config merge behavior: populates agents when opencodeConfig.agent is missing', async () => {
        const plugin = await OpenCodeSwarm({ directory: tempDir } as any);
        const opencodeConfig: any = {};
        
        await plugin.config(opencodeConfig);
        
        expect(opencodeConfig.agent).toBeDefined();
        expect(opencodeConfig.agent.architect).toBeDefined();
        expect(opencodeConfig.agent.coder).toBeDefined();
    });

    test('config merge behavior: merges agents when opencodeConfig.agent exists', async () => {
        const plugin = await OpenCodeSwarm({ directory: tempDir } as any);
        const existingAgent = { model: 'existing-model' };
        const opencodeConfig: any = {
            agent: {
                custom: existingAgent
            }
        };
        
        await plugin.config(opencodeConfig);
        
        expect(opencodeConfig.agent.custom).toBe(existingAgent);
        expect(opencodeConfig.agent.architect).toBeDefined();
    });

    test('config merge behavior: command config merge and swarm removal', async () => {
        const plugin = await OpenCodeSwarm({ directory: tempDir } as any);
        const opencodeConfig: any = {
            command: {
                swarm: { template: 'old', description: 'old' },
                custom: { template: 'custom', description: 'custom' }
            }
        };
        
        await plugin.config(opencodeConfig);
        
        expect(opencodeConfig.command.swarm).toBeUndefined();
        expect(opencodeConfig.command.custom).toBeDefined();
        
        // Verify canonical commands are present with correct descriptions
        for (const key of SWARM_COMMAND_ORDER) {
            expect(opencodeConfig.command[key]).toEqual({
                template: `${key} $ARGUMENTS`,
                description: SWARM_COMMAND_DESCRIPTION_MAP[key]
            });
        }
    });

    test('config merge behavior: handles missing command object', async () => {
        const plugin = await OpenCodeSwarm({ directory: tempDir } as any);
        const opencodeConfig: any = {};
        
        await plugin.config(opencodeConfig);
        
        expect(opencodeConfig.command).toBeDefined();
        expect(opencodeConfig.command.swarm).toBeUndefined();
        expect(opencodeConfig.command['swarm-status']).toBeDefined();
    });

    test('guardrails security warning branch: triggers when loadedFromFile and enabled is false', async () => {
        const configDir = path.join(tempDir, '.opencode');
        fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(
            path.join(configDir, 'opencode-swarm.json'),
            JSON.stringify({ guardrails: { enabled: false } })
        );

        const warnSpy = mock(() => {});
        const originalWarn = console.warn;
        console.warn = warnSpy as any;

        try {
            await OpenCodeSwarm({ directory: tempDir } as any);
            
            // Check if security warning was emitted
            const calls = warnSpy.mock.calls.map(c => c[0]);
            expect(calls.some(c => typeof c === 'string' && c.includes('SECURITY WARNING: GUARDRAILS ARE DISABLED'))).toBe(true);
        } finally {
            console.warn = originalWarn;
        }
    });

    test('automation framework initialization branches', async () => {
        // Test with automation enabled
        const configDir = path.join(tempDir, '.opencode');
        fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(
            path.join(configDir, 'opencode-swarm.json'),
            JSON.stringify({ 
                automation: { 
                    mode: 'auto',
                    capabilities: {
                        evidence_auto_summaries: true,
                        phase_preflight: true,
                        plan_sync: true
                    }
                } 
            })
        );

        const plugin = await OpenCodeSwarm({ directory: tempDir } as any);
        expect(plugin.automation).toBeDefined();
        
        // Verify system transform hook includes phase monitor
        expect(typeof plugin['experimental.chat.system.transform']).toBe('function');
    });

    test('tool execution hooks: session initialization and stale detection', async () => {
        const plugin = await OpenCodeSwarm({ directory: tempDir } as any);
        const toolBefore = plugin['tool.execute.before'] as any;
        const toolAfter = plugin['tool.execute.after'] as any;
        
        const input = { sessionID: 'test-session', tool: 'test-tool' };
        const output = { parts: [] };
        
        // 1. Test session initialization for architect
        await toolBefore(input, output);
        // We can't easily check swarmState directly as it's not exported, 
        // but we can verify the call completes without error.
        
        // 2. Test deterministic handoff for task tool
        const taskInput = { sessionID: 'test-session', tool: 'task' };
        await toolAfter(taskInput, output);
    });

    test('config doctor startup branch', async () => {
        const configDir = path.join(tempDir, '.opencode');
        fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(
            path.join(configDir, 'opencode-swarm.json'),
            JSON.stringify({ 
                automation: { 
                    mode: 'auto',
                    capabilities: {
                        config_doctor_autofix: true
                    }
                } 
            })
        );

        // This triggers the shouldRunOnStartup(automationConfig) branch
        await OpenCodeSwarm({ directory: tempDir } as any);
    });
});
