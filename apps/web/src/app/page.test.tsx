import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HomePage from './page';

vi.mock('@/lib/api', () => ({
  createProject: vi.fn(),
  fetchProjects: vi.fn().mockResolvedValue([]),
}));

function renderHomePage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <HomePage />
    </QueryClientProvider>,
  );
}

describe('HomePage', () => {
  it('renders the project list empty state', async () => {
    renderHomePage();

    expect(screen.getByRole('heading', { name: 'Projects' })).toBeTruthy();
    expect(await screen.findByText('No projects yet')).toBeTruthy();
  });
});
