import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ConnectionWorkspace } from './ConnectionWorkspace';

const { dispatchMock, mockState, apiMock } = vi.hoisted(() => ({
  dispatchMock: vi.fn(),
  mockState: {
    tabs: {
      activeTabId: 'connection-tab-1',
      allTabs: [
        {
          id: 'connection-tab-1',
          type: 'connection',
          objectId: 'b59b4ff3-a71c-4366-a243-197cff6e2fdc',
          objectName: 'Account_Type',
          hierarchyPath: 'Connections → Account_Type',
          unsaved: false,
          isDirty: false,
        },
      ],
    },
    ui: {
      subTabMap: {
        'connection-tab-1': 'properties',
      },
    },
  },
  apiMock: {
    getConnection: vi.fn(),
    updateConnection: vi.fn(),
    testConnectionById: vi.fn(),
    getConnectionUsage: vi.fn(),
    getConnectionHistory: vi.fn(),
    getConnectionPermissions: vi.fn(),
    introspectSchemas: vi.fn(),
    introspectTables: vi.fn(),
    importMetadata: vi.fn(),
  },
}));

vi.mock('@/store/hooks', () => ({
  useAppDispatch: () => dispatchMock,
  useAppSelector: (selector: (state: any) => any) => selector(mockState),
}));

vi.mock('@/services/api', () => ({
  default: apiMock,
}));

describe('ConnectionWorkspace save flow', () => {
  beforeEach(() => {
    dispatchMock.mockReset();
    Object.values(apiMock).forEach(fn => fn.mockReset());
  });

  it('saves updated CSV file path and reloads persisted connector payload', async () => {
    apiMock.getConnection
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            connectorId: 'b59b4ff3-a71c-4366-a243-197cff6e2fdc',
            connectorDisplayName: 'Account_Type',
            connectorTypeCode: 'FILE_CSV',
            configJson: {
              storage_type: 'LOCAL',
              storage_base_path: '/home/venkateswarlu/Documents/ETL_test_Files/Source',
              field_separator_char: ',',
              encoding_standard_code: 'UTF-8',
            },
            fileFormatOptions: {
              field_separator_char: ',',
              encoding_standard_code: 'UTF-8',
            },
            healthStatusCode: 'UNKNOWN',
            connMaxPoolSizeNum: 5,
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            connectorId: 'b59b4ff3-a71c-4366-a243-197cff6e2fdc',
            connectorDisplayName: 'Account_Type',
            connectorTypeCode: 'FILE_CSV',
            configJson: {
              storage_type: 'LOCAL',
              storage_base_path: '/tmp/updated-from-save',
              field_separator_char: ',',
              encoding_standard_code: 'UTF-8',
            },
            fileFormatOptions: {
              field_separator_char: ',',
              encoding_standard_code: 'UTF-8',
            },
            healthStatusCode: 'UNKNOWN',
            connMaxPoolSizeNum: 5,
          },
        },
      });

    apiMock.updateConnection.mockResolvedValue({
      data: {
        success: true,
        data: {
          connectorId: 'b59b4ff3-a71c-4366-a243-197cff6e2fdc',
          connectorDisplayName: 'Account_Type',
          connectorTypeCode: 'FILE_CSV',
          configJson: {
            storage_type: 'LOCAL',
            storage_base_path: '/tmp/updated-from-save',
            field_separator_char: ',',
            encoding_standard_code: 'UTF-8',
          },
          fileFormatOptions: {
            field_separator_char: ',',
            encoding_standard_code: 'UTF-8',
          },
          healthStatusCode: 'UNKNOWN',
          connMaxPoolSizeNum: 5,
        },
      },
    });

    render(<ConnectionWorkspace tabId="connection-tab-1" />);

    const filePathInput = await screen.findByDisplayValue('/home/venkateswarlu/Documents/ETL_test_Files/Source');

    fireEvent.change(filePathInput, { target: { value: '/tmp/updated-from-save' } });

    const saveButtons = await screen.findAllByRole('button', { name: /save/i });
    fireEvent.click(saveButtons[saveButtons.length - 1]!);

    await waitFor(() => {
      expect(apiMock.updateConnection).toHaveBeenCalledWith(
        'b59b4ff3-a71c-4366-a243-197cff6e2fdc',
        expect.objectContaining({
          connectorDisplayName: 'Account_Type',
          config: expect.objectContaining({
            storage_base_path: '/tmp/updated-from-save',
            field_separator_char: ',',
            encoding_standard_code: 'UTF-8',
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(apiMock.getConnection).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('/tmp/updated-from-save')).toBeTruthy();
    });
  });
});
