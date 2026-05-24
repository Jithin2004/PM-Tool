export interface TypeSpec {
  size: string;
  lineHeight: number;
  weight: number;
  letterSpacing: string;
}

export interface TypeScale {
  display: TypeSpec;
  heading1: TypeSpec;
  heading2: TypeSpec;
  heading3: TypeSpec;
  body: TypeSpec;
  bodySmall: TypeSpec;
  caption: TypeSpec;
  telemetry: TypeSpec;
  label: TypeSpec;
}

export const TYPESCALE: TypeScale = {
  display:       { size: '2.25rem',  lineHeight: 1.2,  weight: 500, letterSpacing: '-0.02em' },
  heading1:      { size: '1.5rem',   lineHeight: 1.25, weight: 500, letterSpacing: '-0.015em' },
  heading2:      { size: '1.25rem',  lineHeight: 1.3,  weight: 500, letterSpacing: '-0.01em' },
  heading3:      { size: '1rem',     lineHeight: 1.4,  weight: 500, letterSpacing: '0' },
  body:          { size: '0.875rem', lineHeight: 1.5,  weight: 400, letterSpacing: '0' },
  bodySmall:     { size: '0.8125rem',lineHeight: 1.5,  weight: 400, letterSpacing: '0' },
  caption:       { size: '0.75rem',  lineHeight: 1.4,  weight: 400, letterSpacing: '0.01em' },
  telemetry:     { size: '0.6875rem',lineHeight: 1.4,  weight: 450, letterSpacing: '0.02em' },
  label:         { size: '0.6875rem',lineHeight: 1.33, weight: 600, letterSpacing: '0.06em' },
};
