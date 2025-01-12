import React, { useState } from 'react';
import { useSendMessageMutation } from '../api';

interface MessageInputProps {
  roomId: string;
}

export function MessageInput({ roomId }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [sendMessage] = useSendMessageMutation();

  const handleSend = async () => {
    if (!content.trim()) return;
    await sendMessage({ roomId, content });
    setContent('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className="mt-2 flex space-x-2">
      <input
        type="text"
        className="border rounded px-2 py-1 flex-1"
        placeholder="Type your message..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button
        className="bg-blue-600 text-white px-4 py-1 rounded"
        onClick={handleSend}
      >
        Send
      </button>
    </div>
  );
}