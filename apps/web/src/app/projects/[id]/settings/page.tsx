'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { fetchProject, fetchTokens, createToken } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

export default function ProjectSettingsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const queryClient = useQueryClient();

  const [newTokenName, setNewTokenName] = useState('');
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => fetchProject(projectId),
  });

  const { data: tokens = [], isLoading: tokensLoading } = useQuery({
    queryKey: ['tokens', projectId],
    queryFn: () => fetchTokens(projectId),
  });

  const createTokenMutation = useMutation({
    mutationFn: (name: string) => createToken(projectId, { name }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tokens', projectId] });
      setCreatedToken(data.token);
      setNewTokenName('');
      setShowCreateForm(false);
    },
  });

  const handleCreateToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTokenName.trim()) {
      createTokenMutation.mutate(newTokenName.trim());
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <Link href="/" className="hover:text-blue-600">Projects</Link>
          <span>/</span>
          <Link href={`/projects/${projectId}`} className="hover:text-blue-600">
            {project?.name}
          </Link>
          <span>/</span>
          <span>Settings</span>
        </div>
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
      </div>

      {/* Project Info */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Project Details</h2>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-slate-500">Name</dt>
            <dd className="font-medium text-slate-900 mt-1">{project?.name}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Project ID</dt>
            <dd className="font-mono text-sm text-slate-700 mt-1 bg-slate-100 px-2 py-1 rounded">
              {projectId}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Created</dt>
            <dd className="font-medium text-slate-900 mt-1">
              {project ? formatDateTime(project.createdAt.toString()) : '—'}
            </dd>
          </div>
        </dl>
      </div>

      {/* Ingest Tokens */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Ingest Tokens</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Use these tokens to authenticate event ingestion requests.
            </p>
          </div>
          <button
            className="btn-primary text-sm"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            + New Token
          </button>
        </div>

        {/* Show newly created token */}
        {createdToken && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-green-800 mb-1">Token created!</p>
                <p className="text-sm text-green-700 mb-2">
                  Copy this token now — it will not be shown again.
                </p>
                <code className="block bg-white border border-green-200 rounded px-3 py-2 text-sm font-mono text-slate-800 break-all">
                  {createdToken}
                </code>
              </div>
              <button
                onClick={() => setCreatedToken(null)}
                className="text-green-600 hover:text-green-800 ml-4 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(createdToken)}
              className="mt-2 text-sm text-green-700 hover:text-green-900 font-medium underline"
            >
              Copy to clipboard
            </button>
          </div>
        )}

        {/* Create token form */}
        {showCreateForm && (
          <form onSubmit={handleCreateToken} className="flex gap-3 mb-4">
            <input
              className="input"
              placeholder="Token name (e.g. Production, Development)"
              value={newTokenName}
              onChange={(e) => setNewTokenName(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              className="btn-primary whitespace-nowrap"
              disabled={createTokenMutation.isPending}
            >
              {createTokenMutation.isPending ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              className="btn-secondary whitespace-nowrap"
              onClick={() => setShowCreateForm(false)}
            >
              Cancel
            </button>
          </form>
        )}

        {/* Tokens list */}
        {tokensLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : tokens.length === 0 ? (
          <div className="text-center py-10 text-slate-500">
            No tokens yet. Create one to start ingesting events.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {tokens.map((token) => (
              <div key={token.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-800">{token.name}</p>
                  <p className="text-sm text-slate-400 mt-0.5">
                    Created {formatDateTime(token.createdAt)}
                    {token.lastUsedAt && (
                      <> · Last used {formatDateTime(token.lastUsedAt)}</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-500">
                    {token.id.substring(0, 8)}...
                  </code>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Usage instructions */}
        <div className="mt-6 pt-6 border-t border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Usage Example</h3>
          <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs overflow-x-auto">
{`curl -X POST ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/ingest/events \\
  -H "Authorization: Bearer <your-token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "events": [{
      "provider": "openai",
      "endpoint": "/v1/chat/completions",
      "method": "POST",
      "statusCode": 200,
      "latencyMs": 450,
      "ts": "${new Date().toISOString()}"
    }]
  }'`}
          </pre>
        </div>
      </div>
    </div>
  );
}
