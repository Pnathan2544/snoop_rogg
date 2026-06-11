import { describe, expect, it } from 'vitest';
import { apiEvents, createDbClient, getDb, projects } from './index';

describe('@rate-snoop/db public exports', () => {
  it('exports schema tables and client helpers', () => {
    expect(projects).toBeDefined();
    expect(apiEvents).toBeDefined();
    expect(createDbClient).toEqual(expect.any(Function));
    expect(getDb).toEqual(expect.any(Function));
  });
});
