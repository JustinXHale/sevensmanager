import { describe, expect, it } from 'vitest';
import { DEFAULT_TALLY_LAYOUT, loadTallyLayout, reorderList } from './tallyLayout';

describe('tallyLayout', () => {
  it('reorders list items', () => {
    expect(reorderList(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  });

  it('returns defaults when storage empty', () => {
    expect(loadTallyLayout().attack).toEqual(DEFAULT_TALLY_LAYOUT.attack);
  });
});
