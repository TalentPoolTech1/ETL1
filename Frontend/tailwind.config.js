/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // ── All colors reference CSS variables — :root is the single source of truth ──
      colors: {
        // Backgrounds
        'bg':    'var(--bg)',
        'bg-2':  'var(--bg-2)',
        'bg-3':  'var(--bg-3)',
        'bg-4':  'var(--bg-4)',
        'bg-5':  'var(--bg-5)',
        'bg-6':  'var(--bg-6)',
        // Borders
        'bd':    'var(--bd)',
        'bd-2':  'var(--bd-2)',
        // Text
        'tx1':   'var(--tx1)',
        'tx2':   'var(--tx2)',
        'tx3':   'var(--tx3)',
        // Accent
        'ac':    'var(--ac)',
        'ac-lt': 'var(--ac-lt)',
        'ac-bg': 'var(--ac-bg)',
        // Status
        'ok':       'var(--ok)',
        'ok-bg':    'var(--ok-bg)',
        'warn':     'var(--warn)',
        'warn-bg':  'var(--warn-bg)',
        'err':      'var(--err)',
        'err-bg':   'var(--err-bg)',
        // Semantic icon accent colors (used for entity-type icons in sidebar)
        'ic-pipeline':     'var(--ic-pipeline)',
        'ic-orch':         'var(--ic-orch)',
        'ic-folder':       'var(--ic-folder)',
        'ic-connection':   'var(--ic-connection)',
        'ic-metadata':     'var(--ic-metadata)',
        'ic-user':         'var(--ic-user)',
        'ic-role':         'var(--ic-role)',
        'ic-monitor':      'var(--ic-monitor)',
        'ic-lineage':      'var(--ic-lineage)',
        'ic-tech':         'var(--ic-tech)',
        'ic-project':      'var(--ic-project)',
        // Data-type badge colors
        'dt-number':       'var(--dt-number)',
        'dt-string':       'var(--dt-string)',
        'dt-date':         'var(--dt-date)',
      },
      // ── Font sizes reference CSS variables ──
      fontSize: {
        'micro': ['var(--fs-micro)', { lineHeight: '1.4' }],
        'sm':    ['var(--fs-sm)',    { lineHeight: '1.4' }],
        'base':  ['var(--fs-base)', { lineHeight: '1.45' }],
        'md':    ['var(--fs-md)',   { lineHeight: '1.4' }],
        'lg':    ['var(--fs-lg)',   { lineHeight: '1.3' }],
        'stat':  ['var(--fs-stat)', { lineHeight: '1.2' }],
      },
      // ── Font families reference CSS variables ──
      fontFamily: {
        sans: 'var(--font-base)',
        mono: 'var(--font-mono)',
      },
      // ── Font weights reference CSS variables ──
      fontWeight: {
        normal: 'var(--fw-normal)',
        medium: 'var(--fw-medium)',
        semi:   'var(--fw-semi)',
        bold:   'var(--fw-bold)',
      },
      // ── Spacing stays as-is (layout spacing is not thematic) ──
      spacing: {
        '1': '8px',
        '2': '16px',
        '3': '24px',
        '4': '32px',
        '5': '40px',
        '6': '48px',
      },
      // ── Border radii reference CSS variables ──
      borderRadius: {
        'sm': 'var(--radius-sm)',
        DEFAULT: 'var(--radius)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-lg)',
      },
      // ── Shadows reference CSS variables ──
      boxShadow: {
        DEFAULT: 'var(--shadow)',
        lg: 'var(--shadow-lg)',
      },
      transitionDuration: {
        fast:   '100ms',
        normal: '150ms',
        slow:   '250ms',
      },
    },
  },
  plugins: [],
}
