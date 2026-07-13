'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchProjects, createProject } from '@/lib/api';
import Link from 'next/link';
import { formatDateTime } from '@/lib/utils';

export default function HomePage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  const { data: projects = [], isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });

  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowCreate(false);
      setNewName('');
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      createMutation.mutate({ name: newName.trim() });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Projects</h1>
          <p className="text-slate-500 mt-1">Monitor API rate limits and performance across your projects.</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => setShowCreate(!showCreate)}
        >
          + New Project
        </button>
      </div>

      {showCreate && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Create Project</h2>
          <form onSubmit={handleCreate} className="flex gap-3">
            <input
              className="input"
              placeholder="Project name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              className="btn-primary whitespace-nowrap"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              className="btn-secondary whitespace-nowrap"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </button>
          </form>
          {createMutation.isError && (
            <p className="text-red-500 text-sm mt-2">
              Failed to create project. Please try again.
            </p>
          )}
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-slate-500">Loading projects...</div>
        </div>
      )}

      {error && (
        <div className="card border-red-200 bg-red-50">
          <p className="text-red-600">Failed to load projects. Make sure the API is running.</p>
        </div>
      )}

      {!isLoading && !error && projects.length === 0 && (
        <div className="card text-center py-16">
          <div className="text-6xl mb-4">📡</div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">No projects yet</h2>
          <p className="text-slate-500 mb-6">
            Create your first project to start monitoring API rates.
          </p>
          <button
            className="btn-primary"
            onClick={() => setShowCreate(true)}
          >
            Create your first project
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => (
          <Link key={project.id} href={`/projects/${project.id}`}>
            <div className="card hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900 text-lg">{project.name}</h3>
                  <p className="text-slate-400 text-sm mt-1">
                    Created {formatDateTime(project.createdAt)}
                  </p>
                </div>
                <span className="badge bg-green-100 text-green-800">Active</span>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-sm text-blue-600 font-medium">
                View Dashboard →
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
