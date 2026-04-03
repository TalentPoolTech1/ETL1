import React from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setTheme, setDensity } from '@/store/slices/uiSlice';
import { Toggle } from '@/components/common/Toggle';

export function ThemeSettings() {
  const dispatch = useAppDispatch();
  const { theme, density } = useAppSelector(state => state.ui);

  return (
    <div className="space-y-4 p-4 rounded-lg" style={{ background: 'var(--bg-5)', border: '1px solid var(--bd)' }}>
      <div>
        <h3 className="thm-heading-3 mb-2">Appearance</h3>
        <Toggle
          enabled={theme === 'dark'}
          onChange={enabled => dispatch(setTheme(enabled ? 'dark' : 'light'))}
          label="Dark Mode"
        />
      </div>

      <div className="pt-4" style={{ borderTop: '1px solid var(--bd)' }}>
        <h3 className="thm-heading-3 mb-2">Display Density</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={density === 'normal'}
              onChange={() => dispatch(setDensity('normal'))} className="w-4 h-4 accent-blue-500" />
            <span style={{ fontSize: 'var(--fs-base)', color: 'var(--tx1)' }}>Normal</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={density === 'compact'}
              onChange={() => dispatch(setDensity('compact'))} className="w-4 h-4 accent-blue-500" />
            <span style={{ fontSize: 'var(--fs-base)', color: 'var(--tx1)' }}>Compact</span>
          </label>
        </div>
      </div>
    </div>
  );
}
