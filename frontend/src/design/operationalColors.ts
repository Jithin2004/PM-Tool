export interface ColorTokens {
  neutral: {
    bg: string;
    surface: string;
    border: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
    textQuaternary: string;
  };
  signal: {
    critical: string;
    warning: string;
    safe: string;
    info: string;
  };
  accent: {
    primary: string;
    secondary: string;
  };
}

export const LIGHT_TOKENS: ColorTokens = {
  neutral: {
    bg: '#f5f5f4',
    surface: '#ffffff',
    border: '#e7e5e4',
    text: '#1c1917',
    textSecondary: '#57534e',
    textTertiary: '#a8a29e',
    textQuaternary: '#d6d3d1',
  },
  signal: {
    critical: '#dc2626',
    warning: '#d97706',
    safe: '#16a34a',
    info: '#2563eb',
  },
  accent: {
    primary: '#0f172a',
    secondary: '#1e293b',
  },
};

export const DARK_TOKENS: ColorTokens = {
  neutral: {
    bg: '#0c0a09',
    surface: '#1c1917',
    border: '#292524',
    text: '#fafaf9',
    textSecondary: '#a8a29e',
    textTertiary: '#57534e',
    textQuaternary: '#292524',
  },
  signal: {
    critical: '#fca5a5',
    warning: '#fcd34d',
    safe: '#86efac',
    info: '#93c5fd',
  },
  accent: {
    primary: '#fafaf9',
    secondary: '#e7e5e4',
  },
};
