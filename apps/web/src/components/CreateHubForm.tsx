import React, { useState } from 'react';
import { useCreateHubMutation } from '../api';
import { useParams } from 'react-router-dom';
import { Button } from './ui/button';

export function CreateHubForm() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [createHub] = useCreateHubMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !name.trim()) return;

    try {
      await createHub({
        workspaceId,
        data: {
          name: name.trim(),
          description: description.trim() || undefined
        }
      });
      setName('');
      setDescription('');
    } catch (error) {
      console.error('Failed to create hub:', error);
    }
  };

  if (!workspaceId) return null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Hub Name
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          placeholder="Enter hub name"
          required
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          placeholder="Enter hub description (optional)"
          rows={3}
        />
      </div>

      <Button type="submit" disabled={!name.trim()}>
        Create Hub
      </Button>
    </form>
  );
} 