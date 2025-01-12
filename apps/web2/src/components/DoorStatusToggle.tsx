import React from 'react';
import { useToggleDoorStatusMutation } from '../api';

type DoorStatusToggleProps = {
  userId: string;
  currentStatus: 'open' | 'closed';
};

export function DoorStatusToggle({ userId, currentStatus }: DoorStatusToggleProps) {
  const [toggleDoorStatus] = useToggleDoorStatusMutation();

  const toggleStatus = async () => {
    const nextStatus = currentStatus === 'open' ? 'closed' : 'open';
    await toggleDoorStatus({ userId, doorStatus: nextStatus });
  };

  return (
    <button
      className="border px-2 py-1 rounded"
      onClick={toggleStatus}
    >
      Door is currently [{currentStatus}] - Click to toggle
    </button>
  );
}