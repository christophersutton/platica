import React from 'react';
import { Message } from '../../../shared/types';

export function MessageItem({ message }: { message: Message }) {
  return (
    <div className="bg-gray-50 rounded p-2">
      <div className="text-sm text-gray-600">
        <strong>User {message.userId}</strong> said:
      </div>
      <div>{message.content}</div>
      <div className="text-xs text-gray-400">
        {new Date(message.createdAt).toLocaleTimeString()}
      </div>
    </div>
  );
}