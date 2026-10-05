/**
 * Thin wrapper that renders the shared QueueBoard component for the admin
 * tab - all the actual queue logic lives in components/queue/QueueBoard.tsx.
 */
import React from 'react';
import { QueueBoard } from '../../components/queue/QueueBoard';

export default function AdminQueue() {
  return <QueueBoard />;
}
