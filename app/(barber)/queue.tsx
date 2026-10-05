/**
 * Thin wrapper that renders the shared QueueBoard component for the barber
 * tab - see components/queue/QueueBoard.tsx for the actual logic.
 */
import React from 'react';
import { QueueBoard } from '../../components/queue/QueueBoard';

export default function BarberQueue() {
  return <QueueBoard />;
}
