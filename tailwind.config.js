/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,vue}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
        sans: ['Noto Sans SC', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        cyan: {
          400: '#00f0ff',
          500: '#00d4e5',
        },
        purple: {
          400: '#a78bfa',
          500: '#7c3aed',
        },
        // 语义化颜色（与 CSS 变量配合）
        surface: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
          card: 'var(--bg-card)',
          elevated: 'var(--bg-elevated)',
          code: 'var(--bg-code)',
        },
        ink: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          dim: 'var(--text-dim)',
          'very-dim': 'var(--text-very-dim)',
        },
        edge: {
          subtle: 'var(--border-subtle)',
          card: 'var(--border-card)',
          light: 'var(--border-light)',
          hover: 'var(--border-hover)',
        },
      },
    },
  },
  plugins: [],
};
