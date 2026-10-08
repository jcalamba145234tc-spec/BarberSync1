/**
 * Tap-to-pick month calendar. Days view: tap any date. Tap the "October 2026"
 * title to switch to a month view, where you can jump to any month and use the
 * arrows to change year. Built from plain React Native + Paper pieces, so it
 * needs no extra package and works in Expo Go as well as a built app.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, IconButton, Text } from 'react-native-paper';
import { Colors } from '../../constants/colors';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface CalendarPickerProps {
  /** The currently selected day. */
  value: Date;
  /** Called with the tapped day (local time). */
  onChange: (date: Date) => void;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function CalendarPicker({ value, onChange }: CalendarPickerProps) {
  const [viewYear, setViewYear] = useState(value.getFullYear());
  const [viewMonth, setViewMonth] = useState(value.getMonth());
  const [mode, setMode] = useState<'days' | 'months'>('days');

  // Follow the selection when it changes from outside (e.g. the day arrows
  // on the screen crossing into another month).
  useEffect(() => {
    setViewYear(value.getFullYear());
    setViewMonth(value.getMonth());
  }, [value]);

  const today = new Date();

  // Leading blanks so day 1 lands under the right weekday, then 1..N.
  const cells = useMemo(() => {
    const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const list: (number | null)[] = Array(firstWeekday).fill(null);
    for (let day = 1; day <= daysInMonth; day += 1) list.push(day);
    return list;
  }, [viewYear, viewMonth]);

  const step = (direction: 1 | -1) => {
    if (mode === 'months') {
      setViewYear((year) => year + direction);
      return;
    }
    const next = new Date(viewYear, viewMonth + direction, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  return (
    <View>
      <View style={styles.header}>
        <IconButton
          icon="chevron-left"
          size={22}
          onPress={() => step(-1)}
          accessibilityLabel={mode === 'months' ? 'Previous year' : 'Previous month'}
          style={styles.arrow}
        />
        <Pressable
          onPress={() => setMode(mode === 'days' ? 'months' : 'days')}
          accessibilityRole="button"
          accessibilityLabel="Choose month and year"
          style={styles.titleButton}
        >
          <Text variant="titleMedium" style={styles.title}>
            {mode === 'months' ? String(viewYear) : `${MONTHS[viewMonth]} ${viewYear}`}
          </Text>
          <IconButton
            icon={mode === 'months' ? 'chevron-up' : 'chevron-down'}
            size={18}
            style={styles.titleCaret}
          />
        </Pressable>
        <IconButton
          icon="chevron-right"
          size={22}
          onPress={() => step(1)}
          accessibilityLabel={mode === 'months' ? 'Next year' : 'Next month'}
          style={styles.arrow}
        />
      </View>

      {mode === 'months' ? (
        <View style={styles.monthGrid}>
          {MONTHS.map((name, index) => {
            const selected = index === viewMonth;
            return (
              <Pressable
                key={name}
                accessibilityRole="button"
                accessibilityLabel={`${name} ${viewYear}`}
                onPress={() => {
                  setViewMonth(index);
                  setMode('days');
                }}
                style={[styles.monthCell, selected && styles.monthCellSelected]}
              >
                <Text style={[styles.monthText, selected && styles.selectedText]}>
                  {name.slice(0, 3)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((label, index) => (
              <Text key={index} variant="labelSmall" style={styles.weekday}>
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.dayGrid}>
            {cells.map((day, index) => {
              if (day === null) return <View key={`blank-${index}`} style={styles.dayCell} />;
              const date = new Date(viewYear, viewMonth, day);
              const selected = sameDay(date, value);
              const isToday = sameDay(date, today);
              return (
                <View key={day} style={styles.dayCell}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${MONTHS[viewMonth]} ${day}, ${viewYear}`}
                    accessibilityState={{ selected }}
                    onPress={() => onChange(date)}
                    style={[
                      styles.dayButton,
                      isToday && !selected && styles.todayRing,
                      selected && styles.daySelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        isToday && !selected && styles.todayText,
                        selected && styles.selectedText,
                      ]}
                    >
                      {day}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </>
      )}

      <View style={styles.footer}>
        <Button
          compact
          icon="calendar-today"
          onPress={() => {
            onChange(new Date());
            setMode('days');
          }}
        >
          Today
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { margin: 0 },
  titleButton: { flexDirection: 'row', alignItems: 'center' },
  title: { fontWeight: '700', color: Colors.text },
  titleCaret: { margin: 0 },
  weekRow: { flexDirection: 'row', marginTop: 4 },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', color: Colors.textMuted, fontWeight: '700' },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  dayButton: { flex: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: Colors.primary },
  todayRing: { borderWidth: 1.5, borderColor: Colors.accent },
  dayText: { color: Colors.text, fontWeight: '600' },
  todayText: { color: Colors.accent, fontWeight: '800' },
  selectedText: { color: '#FFFFFF', fontWeight: '800' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 8 },
  monthCell: {
    width: '23%',
    flexGrow: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  monthCellSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  monthText: { color: Colors.text, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
});
