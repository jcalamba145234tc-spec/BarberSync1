/**
 * Bare stack layout for the login flow, with the header hidden.
 */
import React from 'react';
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
