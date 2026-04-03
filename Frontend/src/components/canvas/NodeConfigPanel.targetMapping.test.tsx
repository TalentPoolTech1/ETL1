import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NodeConfigPanel } from './NodeConfigPanel';
import api from '@/services/api';

const dispatchMock = vi.fn();
let mockState: any;

vi.mock('@/store/hooks', () => ({
  useAppDispatch: () => dispatchMock,
  useAppSelector: (selector: (state: any) => any) => selector(mockState),
}));

vi.mock('@/services/api', () => ({
  default: {
    introspectSchemas: vi.fn(() => Promise.resolve({ data: { data: [] } })),
    introspectTables: vi.fn(() => Promise.resolve({ data: { data: [] } })),
    introspectColumns: vi.fn(() => Promise.resolve({ data: { data: [] } })),
  },
}));

function buildState(config: Record<string, any>) {
  return {
    pipeline: {
      nodes: {
        t1: {
          id: 't1',
          type: 'target',
          name: 'Target 1',
          x: 100,
          y: 100,
          width: 220,
          height: 72,
          config,
          inputs: [{ id: 'in1', name: 'input', type: 'any' }],
          outputs: [{ id: 'out1', name: 'output', type: 'any' }],
          version: 1,
        },
      },
      edges: {},
      activePipeline: { id: 'p1', name: 'P1' },
    },
    connections: {
      connectorsByTech: {},
    },
  };
}

describe('NodeConfigPanel target mapping popup', () => {
  beforeEach(() => {
    dispatchMock.mockClear();
  });

  it('does not auto-open mapping for an unconfigured target node', async () => {
    mockState = buildState({
      sinkType: 'jdbc',
      connectionId: '',
      schema: '',
      table: '',
    });

    render(<NodeConfigPanel nodeId="t1" onClose={() => {}} openSignal={1} />);

    expect(screen.queryByText('Target Mapping')).toBeNull();
    expect(screen.queryByText('Audit Values On Write')).toBeNull();

    await waitFor(() => {
      expect(screen.getByText('Select connection, schema, and table first. Then double-click the target node or use the mapping button.')).not.toBeNull();
    });
  });

  it('auto-opens mapping for a configured target node on openSignal', async () => {
    mockState = buildState({
      sinkType: 'jdbc',
      connectionId: 'conn-1',
      schema: 'public',
      table: 'accounts',
    });

    render(<NodeConfigPanel nodeId="t1" onClose={() => {}} openSignal={2} />);

    expect(screen.queryByText('Audit Values On Write')).toBeNull();
    expect((await screen.findAllByText('Target Mapping')).length).toBeGreaterThan(0);
    expect(screen.getByText('Map source columns, audit values, or leave a target empty to skip it.')).not.toBeNull();
  });

  it('deduplicates repeated target columns returned by introspection', async () => {
    vi.mocked(api.introspectColumns).mockResolvedValueOnce({
      data: {
        data: [
          { columnName: 'id' },
          { columnName: 'id' },
          { columnName: 'code' },
          { columnName: 'code' },
        ],
      },
    } as any);

    mockState = buildState({
      sinkType: 'jdbc',
      connectionId: 'conn-1',
      schema: 'public',
      table: 'accounts',
    });

    render(<NodeConfigPanel nodeId="t1" onClose={() => {}} openSignal={3} />);

    expect((await screen.findAllByText('Target Mapping')).length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(screen.getByText('Targets 2')).not.toBeNull();
    });

    expect(screen.getAllByTitle('id')).toHaveLength(1);
    expect(screen.getAllByTitle('code')).toHaveLength(1);
  });
});
