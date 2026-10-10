import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

export function localDayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Advance relative ranges at local midnight and after returning from background. */
export function useCurrentDay() {
  const [day, setDay] = useState(() => localDayKey());
  const update = useCallback(() => setDay(localDayKey()), []);
  useFocusEffect(useCallback(() => { update(); }, [update]));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      clearTimeout(timer);
      update();
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(schedule, midnight.getTime() - now.getTime() + 50);
    };
    schedule();
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') schedule(); });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [update]);
  return day;
}
