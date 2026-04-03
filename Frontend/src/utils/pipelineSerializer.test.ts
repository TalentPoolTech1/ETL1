import { describe, expect, it } from 'vitest';
import { serializePipelineToDefinition } from './pipelineSerializer';

describe('serializePipelineToDefinition', () => {
  it('falls back to file source type when sourceType is blank but filePath exists', () => {
    const definition = serializePipelineToDefinition(
      { id: 'p1', name: 'P1', version: 1 },
      {
        s1: {
          id: 's1',
          type: 'source',
          name: 'Source 1',
          config: {
            sourceType: '',
            filePath: '/data/input.csv',
          },
        },
      },
      {},
    );

    expect(definition.nodes[0]?.type).toBe('source');
    expect(definition.nodes[0]?.sourceType).toBe('file');
  });

  it('falls back to jdbc source type when sourceType is blank and no file or stream hints exist', () => {
    const definition = serializePipelineToDefinition(
      { id: 'p1', name: 'P1', version: 1 },
      {
        s1: {
          id: 's1',
          type: 'source',
          name: 'Source 1',
          config: {
            sourceType: '   ',
            connectionId: 'conn-1',
            table: 'accounts',
          },
        },
      },
      {},
    );

    expect(definition.nodes[0]?.type).toBe('source');
    expect(definition.nodes[0]?.sourceType).toBe('jdbc');
  });
});
