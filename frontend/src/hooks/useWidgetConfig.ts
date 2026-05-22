import { useState, useCallback } from 'react';

const STORAGE_KEY = 'resolve-widget-config';

interface WidgetConfig {
  visible: string[];
  order: string[];
}

function loadConfig(): WidgetConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { visible: ['health', 'activity', 'radar', 'insights'], order: ['health', 'activity', 'radar', 'insights'] };
}

function saveConfig(config: WidgetConfig) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch { /* ignore */ }
}

export function useWidgetConfig() {
  const [config, setConfig] = useState<WidgetConfig>(loadConfig);

  const toggleWidget = useCallback((id: string) => {
    setConfig((prev) => {
      const visible = prev.visible.includes(id)
        ? prev.visible.filter((v) => v !== id)
        : [...prev.visible, id];
      const next = { ...prev, visible };
      saveConfig(next);
      return next;
    });
  }, []);

  const reorder = useCallback((order: string[]) => {
    setConfig((prev) => {
      const next = { ...prev, order };
      saveConfig(next);
      return next;
    });
  }, []);

  const isVisible = useCallback((id: string) => config.visible.includes(id), [config.visible]);

  return { ...config, toggleWidget, reorder, isVisible };
}
