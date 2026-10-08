/**
 * Month calendar for picking a single day or a date range (used by the
 * Custom tab on the admin Reports screen). Plain React Native + Paper, no
 * extra packages.
 *
 *  - "Single day": tap a date, it is selected right away.
 *  - "Date range": tap the first date, then the last date (either order).
 *
 * `jumpKey` is bumped by the parent when it changes the selection from
 * outside (quick-range chips) so the calendar moves to that month.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, IconButton, SegmentedButtons, Text } from 'react-native-paper';
import { Colors } from '../../constants/colors';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

type Mode = 'DAY' | 'RANGE';

interface RangeCalendarProps {
  from: Date | null;
  to: Date | null;
  onSelect: (from: Date, to: Date) => void;
  jumpKey?: number;
}

const startOfDayLocal = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const monthStartOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function RangeCalendar({ from, to, onSelect, jumpKey = 0 }: RangeCalendarProps) {
  const [mode, setMode] = useState<Mode>(from && to && !sameDay(from, to) ? 'RANGE' : 'DAY');
  const [pending, setPending] = useState<Date | null>(null);
  const [view, setView] = useState<Date>(() => monthStartOf(from ?? new Date()));
  const today = startOfDayLocal(new Date());

  // Selection changed from outside (quick ranges): show its month, drop any half-picked range.
  useEffect(() => {
    setPending(null);
    setView(monthStartOf(from ?? new Date()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpKey]);

  const rows = useMemo(() => {
    const year = view.getFullYear();
    const month = view.getMonth();
    const offset = new Date(year, month, 1).getDay();
    const count = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < 42; i += 1) {
      const dayNumber = i - offset + 1;
      cells.push(dayNumber >= 1 && dayNumber <= count ? new Date(year, month, dayNumber) : null);
    }
    return Array.from({ length: 6 }, (_, r) => cells.slice(r * 7, r * 7 + 7));
  }, [view]);

  const fromDay = from ? startOfDayLocal(from) : null;
  const toDay = to ? startOfDayLocal(to) : null;
  const isRange = !!fromDay && !!toDay && fromDay.getTime() !== toDay.getTime();

  const changeMode = (value: string) => {
    setMode(value as Mode);
    setPending(null);
  };

  const handlePress = (date: Date) => {
    if (mode === 'DAY') {
      onSelect(date, date);
      return;
    }
    if (!pending) {
      setPending(date);
      return;
    }
    const first = pending.getTime() <= date.getTime() ? pending : date;
    const last = pending.getTime() <= date.getTime() ? date : pending;
    setPending(null);
    onSelect(first, last);
  };

  const shiftMonth = (delta: number) =>
    setView((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));

  const hint =
    mode === 'DAY'
      ? 'Tap a date to see its report.'
      : pending
        ? 'Now tap the last date of the range.'
        : 'Tap the first date, then the last date.';

  return (
    <View style={styles.wrap}>
      <SegmentedButtons
        value={mode}
        onValueChange={changeMode}
        buttons={[
          { value: 'DAY', label: 'Single day' },
          { value: 'RANGE', label: 'Date range' },
        ]}
      />

      <View style={styles.calendar}>
        <View style={styles.header}>
          <IconButton icon="chevron-left" size={22} onPress={() => shiftMonth(-1)} accessibilityLabel="Previous month" />
          <Text variant="titleMedium" style={styles.title}>
            {MONTHS[view.getMonth()]} {view.getFullYear()}
          </Text>
          <IconButton icon="chevron-right" size={22} onPress={() => shiftMonth(1)} accessibilityLabel="Next month" />
        </View>

        <View style={styles.weekRow}>
          {WEEKDAYS.map((label) => (
            <Text key={label} variant="labelSmall" style={styles.weekday}>
              {label}
            </Text>
          ))}
        </View>

        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.weekRow}>
            {row.map((date, colIndex) => {
              if (!date) return <View key={colIndex} style={styles.cell} />;

              const time = date.getTime();
              const isStart = !!fromDay && time === fromDay.getTime();
              const isEnd = !!toDay && time === toDay.getTime();
              const inside = isRange && !!fromDay && !!toDay && time >= fromDay.getTime() && time <= toDay.getTime();
              const isPending = !!pending && sameDay(date, pending);
              const selected = isStart || isEnd || isPending;
              const isToday = time === today.getTime();

              return (
                <Pressable
                  key={colIndex}
                  style={styles.cell}
                  onPress={() => handlePress(date)}
                  accessibilityRole="button"
                  accessibilityLabel={`${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`}
                >
                  {inside && (
                    <View style={[styles.band, isStart && styles.bandStart, isEnd && styles.bandEnd]} />
                  )}
                  <View
                    style={[
                      styles.circle,
                      isToday && !selected && styles.circleToday,
                      selected && styles.circleSelected,
                    ]}
                  >
                    <Text
                      variant="bodyMedium"
                      style={[styles.dayText, selected && styles.dayTextSelected]}
                    >
                      {date.getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <Text variant="bodySmall" style={styles.hint}>
          {hint}
        </Text>
        <Button compact mode="text" onPress={() => setView(monthStartOf(new Date()))}>
          Today
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  calendar: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 6,
    paddingBottom: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontWeight: '700', color: Colors.text },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', color: Colors.textMuted, paddingVertical: 6 },
  cell: { flex: 1, height: 42, alignItems: 'center', justifyContent: 'center' },
  band: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    left: 0,
    right: 0,
    backgroundColor: Colors.accent + '33',
  },
  bandStart: { left: '50%' },
  bandEnd: { right: '50%' },
  circle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleToday: { borderWidth: 1.5, borderColor: Colors.accent },
  circleSelected: { backgroundColor: Colors.primary },
  dayText: { color: Colors.text },
  dayTextSelected: { color: '#FFFFFF', fontWeight: '700' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hint: { flex: 1, color: Colors.textMuted },
});
