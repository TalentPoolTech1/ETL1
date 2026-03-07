import React from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setTheme, setDensity } from '@/store/slices/uiSlice';
import { Toggle } from '@/components/common/Toggle';

export function ThemeSettings() {
  const dispatch = useAppDispatch();
  const { theme, density } = useAppSelector(state => state.ui);

  return (
    <div className="space-y-4 p-4 bg-white rounded-lg border border-neutral-200">
      <div>
        <h3 className="text-sm font-semibold text-neutral-900 mb-2">Appearance</h3>

        <Toggle
          enabled={theme === 'dark'}
          onChange={enabled => dispatch(setTheme(enabled ? 'dark' : 'light'))}
          label="Dark Mode"
        />
      </div>

      <div className="border-t border-neutral-200 pt-4">
        <h3 className="text-sm font-semibold text-neutral-900 mb-2">Display Density</h3>

        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={density === 'normal'}
              onChange={() => dispatch(setDensity('normal'))}
              className="w-4 h-4"
            />
            <span className="text-sm text-neutral-700">Normal</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={density === 'compact'}
              onChange={() => dispatch(setDensity('compact'))}
              className="w-4 h-4"
            />
            <span className="text-sm text-neutral-700">Compact</span>
          </label>
        </div>
      </div>
    </div>
  );
}
