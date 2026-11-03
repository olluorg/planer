import { describe, expect, it } from 'vitest';
import { planOwnedHealthSync } from '../nutritionSync';

describe('nutrition health sync', () => {
  it('leaves manually entered or imported calories alone', () => {
    expect(planOwnedHealthSync(1800, undefined, 0, 0)).toEqual({action:'keep', owned:false});
    expect(planOwnedHealthSync(1800, undefined, 1, 400)).toEqual({action:'keep', owned:false});
    expect(planOwnedHealthSync(1800, 400, 1, 600)).toEqual({action:'keep', owned:false});
  });
  it('updates only its own data and removes it when the food log becomes empty', () => {
    expect(planOwnedHealthSync(undefined, undefined, 1, 400)).toEqual({action:'write', value:400});
    expect(planOwnedHealthSync(400, 400, 2, 600)).toEqual({action:'write', value:600});
    expect(planOwnedHealthSync(600, 600, 0, 0)).toEqual({action:'remove'});
  });
});
