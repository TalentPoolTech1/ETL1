import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PipelineCanvas } from './PipelineCanvas';

const dispatchMock = vi.fn();

const mockState = {
  pipeline: {
    nodes: {
      n1: {
        id: 'n1',
        type: 'transform',
        name: 'Transform 3',
        x: 100,
        y: 100,
        width: 220,
        height: 72,
        config: {},
        inputs: [{ id: 'in1', name: 'input', type: 'any' }],
        outputs: [{ id: 'out1', name: 'output', type: 'any' }],
        version: 1,
      },
    },
    edges: {},
    selectedNodeIds: [],
    activePipeline: { name: 'P1' },
  },
};

vi.mock('@/store/hooks', () => ({
  useAppDispatch: () => dispatchMock,
  useAppSelector: (selector: (state: any) => any) => selector(mockState),
}));

vi.mock('@/services/api', () => ({
  default: {},
}));

describe('PipelineCanvas double click', () => {
  it('calls onNodeDoubleClick when transform node is double-clicked', () => {
    const onNodeDoubleClick = vi.fn();

    render(<PipelineCanvas onNodeDoubleClick={onNodeDoubleClick} pipelineId="p1" />);

    const nodeText = screen.getByText('Transform 3');
    fireEvent.doubleClick(nodeText);

    expect(onNodeDoubleClick).toHaveBeenCalled();
    expect(onNodeDoubleClick).toHaveBeenCalledWith('n1');
  });
});
