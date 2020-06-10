import { evmRevert, evmSnapshot } from '../../helpers/misc-utils';
import { TEST_SNAPSHOT_ID } from '../../helpers/constants';

export function makeSuite(name: string, tests: () => void) {
  describe(name, function () {
    before(async () => {
      await evmSnapshot();
    });
    tests();
    after(async () => {
      await evmRevert(TEST_SNAPSHOT_ID);
    });
  });
}
