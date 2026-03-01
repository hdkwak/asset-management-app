import { useState, useEffect, useCallback } from 'react';
import { getAppSettings, updateAppSetting } from '../api/client';
import type { AppSettings } from '../types';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAppSettings()
      .then(setSettings)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const updateSetting = useCallback(async (key: string, value: string) => {
    await updateAppSetting(key, value);
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  return { settings, loading, updateSetting };
}
