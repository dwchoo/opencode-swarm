import { describe, it, expect, beforeEach, afterEach, jest, mock } from 'bun:test';
import type { Plan } from '../../../src/config/plan-schema';
import type { PreflightTriggerManager } from '../../../src/background/trigger';

// Mock the loadPlan function before importing the module under test
mock.module('../../../src/plan/manager', () => ({
	loadPlan: jest.fn<(_directory: string) => Promise<Plan | null>>(),
}));

import { loadPlan } from '../../../src/plan/manager';
import { createPhaseMonitorHook } from '../../../src/hooks/phase-monitor';

const mockLoadPlan = loadPlan as jest.MockedFunction<typeof loadPlan>;

// Mock the preflightManager
const mockCheckAndTrigger = jest.fn<(
	phase: number,
	completedTasks: number,
	totalTasks: number
) => Promise<boolean>>();

const mockPreflightManager = {
	checkAndTrigger: mockCheckAndTrigger,
} as unknown as PreflightTriggerManager;

// Test helper to create a mock Plan with multiple phases
function createMockPlan(currentPhaseId: number, phases: Array<{
	id: number;
	tasks: Array<{ status: string }>;
}>): Plan {
	return {
		schema_version: '1.0.0' as const,
		title: 'Test Plan',
		swarm: 'test-swarm',
		current_phase: currentPhaseId,
		phases: phases.map((p) => ({
			id: p.id,
			name: `Phase ${p.id}`,
			status: 'in_progress' as const,
			tasks: p.tasks,
		})),
	};
}

describe('createPhaseMonitorHook', () => {
	const testDirectory = '/test/project';
	let originalEnv: NodeJS.ProcessEnv = {};

	function captureEnv(): NodeJS.ProcessEnv {
		return { ...process.env };
	}

	function restoreEnv(snapshot: NodeJS.ProcessEnv): void {
		const keys = Object.keys(process.env);
		for (const key of keys) {
			if (!(key in snapshot)) {
				// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
				delete process.env[key];
			}
		}

		for (const key of Object.keys(snapshot)) {
			const value = snapshot[key];
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
	}

	beforeEach(() => {
		originalEnv = captureEnv();
		mockLoadPlan.mockReset();
		mockCheckAndTrigger.mockClear();
	});

	afterEach(() => {
		restoreEnv(originalEnv);
		mockCheckAndTrigger.mockClear();
	});

	it('On first call: reads plan, stores phase, does NOT call checkAndTrigger', async () => {
		const plan = createMockPlan(1, [
			{ id: 1, tasks: [{ status: 'pending' }] },
		]);
		mockLoadPlan.mockResolvedValue(plan);

		const hook = createPhaseMonitorHook(testDirectory, mockPreflightManager);

		await hook({}, {});

		// Should have read the plan
		expect(mockLoadPlan).toHaveBeenCalledWith(testDirectory);
		// Should NOT call checkAndTrigger on first call
		expect(mockCheckAndTrigger).not.toHaveBeenCalled();
	});

	it('On subsequent calls with same phase: does NOT call checkAndTrigger', async () => {
		const plan = createMockPlan(1, [
			{ id: 1, tasks: [{ status: 'pending' }] },
		]);
		mockLoadPlan.mockResolvedValue(plan);

		const hook = createPhaseMonitorHook(testDirectory, mockPreflightManager);

		// First call
		await hook({}, {});
		mockLoadPlan.mockClear();

		// Second call with same phase
		await hook({}, {});

		// Should have read the plan again
		expect(mockLoadPlan).toHaveBeenCalled();
		// Should NOT call checkAndTrigger (same phase)
		expect(mockCheckAndTrigger).not.toHaveBeenCalled();
	});

	it('On subsequent calls with different phase: calls checkAndTrigger with correct args', async () => {
		// First call: phase 1 with 2 tasks (1 completed)
		const planPhase1 = createMockPlan(1, [
			{ id: 1, tasks: [{ status: 'completed' }, { status: 'pending' }] },
		]);
		mockLoadPlan.mockResolvedValue(planPhase1);

		const hook = createPhaseMonitorHook(testDirectory, mockPreflightManager);

		// First call - initialize phase
		await hook({}, {});
		mockLoadPlan.mockClear();
		mockCheckAndTrigger.mockClear();

		// Second call: phase 2 - plan must contain BOTH phases to look up previous phase
		const planPhase2 = createMockPlan(2, [
			{ id: 1, tasks: [{ status: 'completed' }, { status: 'pending' }] },
			{ id: 2, tasks: [{ status: 'pending' }, { status: 'pending' }, { status: 'pending' }] },
		]);
		mockLoadPlan.mockResolvedValue(planPhase2);

		// Third call - phase changed
		await hook({}, {});

		// Should call checkAndTrigger with correct arguments
		expect(mockCheckAndTrigger).toHaveBeenCalledWith(
			2, // new phase
			1, // completed tasks from previous phase (phase 1)
			2, // total tasks from previous phase (phase 1)
		);
	});

	it('When loadPlan returns null: does nothing, no error', async () => {
		mockLoadPlan.mockResolvedValue(null);

		const hook = createPhaseMonitorHook(testDirectory, mockPreflightManager);

		// Should not throw - safeHook wraps and swallows errors
		const result = await hook({}, {});
		expect(result).toBeUndefined();

		// Should not call checkAndTrigger
		expect(mockCheckAndTrigger).not.toHaveBeenCalled();
	});

	it('Errors inside the hook are swallowed (safeHook wrapping)', async () => {
		// First call works
		const plan = createMockPlan(1, [
			{ id: 1, tasks: [{ status: 'completed' }] },
		]);
		mockLoadPlan.mockResolvedValue(plan);

		const hook = createPhaseMonitorHook(testDirectory, mockPreflightManager);

		// First call - initialize
		await hook({}, {});
		mockLoadPlan.mockClear();

		// Make loadPlan throw on second call
		mockLoadPlan.mockRejectedValue(new Error('Test error'));

		// Should not throw - error is swallowed by safeHook
		const result = await hook({}, {});
		expect(result).toBeUndefined();

		// checkAndTrigger should not have been called due to error
		expect(mockCheckAndTrigger).not.toHaveBeenCalled();
	});

	it('correctly counts completed and total tasks for the previous phase', async () => {
		// Phase 1: 5 tasks, 3 completed
		const planPhase1 = createMockPlan(1, [
			{
				id: 1,
				tasks: [
					{ status: 'completed' },
					{ status: 'completed' },
					{ status: 'completed' },
					{ status: 'pending' },
					{ status: 'in_progress' },
				],
			},
		]);
		mockLoadPlan.mockResolvedValue(planPhase1);

		const hook = createPhaseMonitorHook(testDirectory, mockPreflightManager);

		// First call
		await hook({}, {});
		mockLoadPlan.mockClear();
		mockCheckAndTrigger.mockClear();

		// Change to phase 2 - include both phases
		const planPhase2 = createMockPlan(2, [
			{
				id: 1,
				tasks: [
					{ status: 'completed' },
					{ status: 'completed' },
					{ status: 'completed' },
					{ status: 'pending' },
					{ status: 'in_progress' },
				],
			},
			{ id: 2, tasks: [{ status: 'pending' }] },
		]);
		mockLoadPlan.mockResolvedValue(planPhase2);

		await hook({}, {});

		// Should count 3 completed out of 5
		expect(mockCheckAndTrigger).toHaveBeenCalledWith(2, 3, 5);
	});

	it('handles missing phase in plan.phases gracefully', async () => {
		// Plan with phase 1
		const planPhase1 = createMockPlan(1, [
			{ id: 1, tasks: [{ status: 'completed' }] },
		]);
		mockLoadPlan.mockResolvedValue(planPhase1);

		const hook = createPhaseMonitorHook(testDirectory, mockPreflightManager);

		// First call
		await hook({}, {});
		mockLoadPlan.mockClear();
		mockCheckAndTrigger.mockClear();

		// Change to phase 3, but with an empty phases array
		const planPhase3: Plan = {
			schema_version: '1.0.0' as const,
			title: 'Test Plan',
			swarm: 'test-swarm',
			current_phase: 3,
			phases: [], // No phases - will cause find() to return undefined
		};
		mockLoadPlan.mockResolvedValue(planPhase3);

		await hook({}, {});

		// Should call checkAndTrigger with 0, 0 for missing phase data
		expect(mockCheckAndTrigger).toHaveBeenCalledWith(3, 0, 0);
	});
});
