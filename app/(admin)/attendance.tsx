import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Checkbox, Text } from 'react-native-paper';

export default function AttendanceScreen() {
  const [attendance, setAttendance] = useState([
    { id: 1, name: 'John', present: true },
    { id: 2, name: 'Mark', present: true },
    { id: 3, name: 'Ryan', present: false },
    { id: 4, name: 'Chris', present: true },
  ]);

  const toggleAttendance = (id: number) => {
    setAttendance((prev) =>
      prev.map((barber) =>
        barber.id === id
          ? { ...barber, present: !barber.present }
          : barber
      )
    );
  };

  const presentCount = attendance.filter((b) => b.present).length;
  const absentCount = attendance.length - presentCount;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Barber Attendance
      </Text>

      <Text variant="bodyMedium" style={styles.summary}>
        Present: {presentCount} | Absent: {absentCount}
      </Text>

      {attendance.map((barber) => (
        <Card key={barber.id} style={styles.card}>
          <Card.Content>
            <View style={styles.row}>
              <Text variant="titleMedium">{barber.name}</Text>

              <Checkbox
                status={barber.present ? 'checked' : 'unchecked'}
                onPress={() => toggleAttendance(barber.id)}
              />
            </View>
          </Card.Content>
        </Card>
      ))}

      <Button
        mode="contained"
        icon="content-save"
        onPress={() => alert('Attendance Saved')}
        style={styles.button}
      >
        Save Attendance
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    marginBottom: 12,
    fontWeight: 'bold',
  },
  summary: {
    marginBottom: 16,
  },
  card: {
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  button: {
    marginTop: 20,
  },
});