import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { OrchestratorEditorSubTab } from './OrchestratorEditorSubTab';

const dispatchMock = vi.fn();
const getOrchestratorMock = vi.fn();

const mockState = {
  projects: {
    pipelinesByProject: {
      proj1: [
        { pipelineId: 'pipe-1', pipelineDisplayName: 'Pipe_Load_Account_Type', projectId: 'proj1' },
      ],
    },
    pipelinesByFolder: {},
    globalPipelines: [],
    orchestratorsByProject: { proj1: [] },
    orchestratorsByFolder: {},
    globalOrchestrators: [],
  },
};

vi.mock('@/store/hooks', () => ({
  useAppDispatch: () => dispatchMock,
  useAppSelector: (selector: (state: any) => any) => selector(mockState),
}));

vi.mock('@/store/slices/projectsSlice', () => ({
  fetchOrchestratorsForProject: vi.fn((projectId: string) => ({ type: 'projects/fetchOrchestratorsForProject', payload: projectId })),
  fetchPipelinesForProject: vi.fn((projectId: string) => ({ type: 'projects/fetchPipelinesForProject', payload: projectId })),
}));

vi.mock('@/services/api', () => ({
  default: {
    getOrchestrator: (...args: any[]) => getOrchestratorMock(...args),
    saveOrchestratorDag: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
}));

describe('OrchestratorEditorSubTab', () => {
  beforeEach(() => {
    dispatchMock.mockClear();
    getOrchestratorMock.mockReset();
    getOrchestratorMock.mockResolvedValue({
      data: {
        data: {
          orchestratorId: 'orch-1',
          projectId: 'proj1',
          dagDefinitionJson: {
            steps: [
              {
                stepId: 'step-1',
                kind: 'pipeline',
                pipelineId: 'pipe-1',
                pipelineName: 'Pipe_Load_Account_Type',
                retryCount: 0,
                timeoutMinutes: 60,
              },
            ],
          },
        },
      },
    });
  });

  it('keeps nodes compact and opens configuration in the side inspector', async () => {
    render(<OrchestratorEditorSubTab orchId="orch-1" />);

    expect(await screen.findByText('Pipe_Load_Account_Type')).not.toBeNull();
    expect(screen.queryByText('Retry Count')).toBeNull();
    expect(screen.queryByText('Success Behavior')).toBeNull();
    expect(screen.queryByText('Failure Behavior')).toBeNull();

    fireEvent.click(screen.getByText('Pipe_Load_Account_Type'));

    await waitFor(() => {
      expect(screen.getByText('Step Configuration')).not.toBeNull();
    });

    expect(screen.getByText('Retry Count')).not.toBeNull();
    expect(screen.getByText('On Success')).not.toBeNull();
    expect(screen.getByText('On Failure')).not.toBeNull();
  });

  it('shows a dedicated move handle for canvas positioning', async () => {
    render(<OrchestratorEditorSubTab orchId="orch-1" />);

    const moveHandles = await screen.findAllByTitle('Drag to move');
    expect(moveHandles.length).toBeGreaterThan(0);
  });
});
