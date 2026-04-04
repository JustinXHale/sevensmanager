import { describe, expect, it } from 'vitest';
import { resolveMatchBackTarget, resolveMatchesReturnTo } from '@/domain/matchNavigation';

describe('resolveMatchesReturnTo', () => {
  it('reads matchesReturnTo from state', () => {
    expect(resolveMatchesReturnTo({ matchesReturnTo: '/team/a?tab=match' })).toBe('/team/a?tab=match');
  });

  it('falls back to home when state missing', () => {
    expect(resolveMatchesReturnTo(undefined)).toBe('/');
  });
});

describe('resolveMatchBackTarget', () => {
  it('prefers navigation state', () => {
    expect(resolveMatchBackTarget({ matchesReturnTo: '/team/x?tab=match' }, null, 'team-1')).toBe(
      '/team/x?tab=match',
    );
  });

  it('uses returnTo query when state is empty', () => {
    expect(resolveMatchBackTarget(undefined, '/team/y?tab=admin', undefined)).toBe('/team/y?tab=admin');
  });

  it('uses team admin when state and query missing', () => {
    expect(resolveMatchBackTarget(undefined, null, 'tid')).toBe('/team/tid?tab=admin&section=roster');
  });

  it('falls back to home with no team', () => {
    expect(resolveMatchBackTarget(undefined, null, undefined)).toBe('/');
  });
});
