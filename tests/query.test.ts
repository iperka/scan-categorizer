import {Query} from '../src/query';

describe('Query', () => {
  describe('Query.and()', () => {
    it('should return correct condition for Query.and()', () => {
      const tests = [
        {
          v: Query.and('test1', 'test2'),
          e: {type: 'and', values: ['test1', 'test2']},
        },
        {
          v: Query.and('test1', /d/),
          e: {type: 'and', values: ['test1', /d/]},
        }
      ];

      tests.forEach((test) => {
        expect(test.v).toEqual(test.e);
      });
    });
  });

  describe('Query.or()', () => {
    it('should return correct condition for Query.or()', () => {
      const tests = [
        {
          v: Query.or('test1', 'test2'),
          e: {type: 'or', values: ['test1', 'test2']},
        },
        {
          v: Query.or('test1', /d/),
          e: {type: 'or', values: ['test1', /d/]},
        },
      ];

      tests.forEach((test) => {
        expect(test.v).toEqual(test.e);
      });
    });
  });

  describe('Query.cleanWords()', () => {
    it('should return correct array for Query.cleanWords()', () => {
      const tests = [
        {
          v: Query.cleanWords(['test1', 'test2']),
          e: ['test1', 'test2'],
        },
        {
          v: Query.cleanWords(['Test1', 'tEst2']),
          e: ['test1', 'test2'],
        },
        {
          v: Query.cleanWords(['Test1 ', ' tEst2', ' d ']),
          e: ['test1', 'test2', 'd'],
        },
        {
          v: Query.cleanWords(['Test1 ', ' tEst2', '']),
          e: ['test1', 'test2'],
        },
      ];

      tests.forEach((test) => {
        expect(test.v).toEqual(test.e);
      });
    });

    it('should handle RegExp in cleanWords', () => {
      const result = Query.cleanWords(['test1', /regex/, 'test2']);
      expect(result).toHaveLength(3);
      expect(result[0]).toBe('test1');
      expect(result[1]).toEqual(/regex/);
      expect(result[2]).toBe('test2');
    });
  });

  describe('Query.applies()', () => {
    it('should return true for Query.applies() with Query.and() conditions', () => {
      const tests = [
        Query.applies(['test1', 'test2'], Query.and('test1', 'test2')),
        Query.applies(['test1', 'test2', 'test3'], Query.and('test1', 'test2')),
        Query.applies(['test1', 'test2', 'test3'], Query.and('test1')),
        Query.applies(
          ['test1', 'test2', 'test3'],
          Query.and('test1', /^test1/),
        ),
        Query.applies(['test1', 'test2', 'test3'], Query.and(/test1 test2/)),
      ];

      tests.forEach((test) => {
        expect(test).toBeTruthy();
      });
    });

    it('should return true for Query.applies() with Query.or() conditions', () => {
      const tests = [
        Query.applies(['test1', 'test2'], Query.or('test1', 'test2')),
        Query.applies(['test1', 'test3', 'test3'], Query.or('test1', 'test4')),
        Query.applies(['test1', 'test2', 'test3'], Query.or('test2')),
        Query.applies(['test1', 'test2', 'test3'], Query.or(/^test1/)),
        Query.applies(['test1', 'test2', 'test3'], Query.or(/test2/, /^test1/)),
      ];

      tests.forEach((test) => {
        expect(test).toBeTruthy();
      });
    });

    it('should return false for Query.applies() with Query.and() conditions', () => {
      const tests = [
        Query.applies(['test1', 'test2'], Query.and('test1', 'test3')),
        Query.applies(
          ['test1', 'test2', 'test3'],
          Query.and('test1', 'test2', 'test4'),
        ),
        Query.applies(['test1', 'test2', 'test3'], Query.and('test4')),
        Query.applies(
          ['test1', 'test2', 'test3'],
          Query.and('test1', /^test2/),
        ),
      ];

      tests.forEach((test) => {
        expect(test).toBeFalsy();
      });
    });

    it('should return false for Query.applies() with Query.or() conditions', () => {
      const tests = [
        Query.applies(['test1', 'test2'], Query.or('test3', 'test4')),
        Query.applies(['test1', 'test3', 'test3'], Query.or('test4', 'test5')),
        Query.applies(['test1', 'test2', 'test3'], Query.or('test4')),
        Query.applies(['test1', 'test2', 'test3'], Query.or(/^test2/)),
        Query.applies(
          ['test1', 'test2', 'test3'],
          Query.or(/^test2/, /test1$/),
        ),
      ];

      tests.forEach((test) => {
        expect(test).toBeFalsy();
      });
    });
  });

  describe('Query.sortMatchesByPriority()', () => {
    it('should return correct order for Query.sortMatchesByPriority()', () => {
      const tests: {v: Query.Category[]; e: Query.Category[]}[] = [
        {
          v: Query.sortMatchesByPriority([
            {name: 'test1', conditions: [], path: ''},
            {name: 'test2', conditions: [], path: ''},
            {name: 'test3', conditions: [], path: ''},
            {name: 'test4', conditions: [], path: ''},
          ]),
          e: [
            {
              name: 'test1',
              conditions: [],
              path: '',
              priority: 0,
            },
            {
              name: 'test2',
              conditions: [],
              path: '',
              priority: 0,
            },
            {
              name: 'test3',
              conditions: [],
              path: '',
              priority: 0,
            },
            {
              name: 'test4',
              conditions: [],
              path: '',
              priority: 0,
            },
          ],
        },
        {
          v: Query.sortMatchesByPriority([
            {name: 'test1', conditions: [], path: ''},
            {name: 'test2', conditions: [], path: ''},
            {name: 'test3', conditions: [], path: ''},
            {
              name: 'test4',
              conditions: [],
              path: '',
              priority: 1,
            },
          ]),
          e: [
            {
              name: 'test4',
              conditions: [],
              path: '',
              priority: 1,
            },
            {
              name: 'test1',
              conditions: [],
              path: '',
              priority: 0,
            },
            {
              name: 'test2',
              conditions: [],
              path: '',
              priority: 0,
            },
            {
              name: 'test3',
              conditions: [],
              path: '',
              priority: 0,
            },
          ],
        },
        {
          v: Query.sortMatchesByPriority([
            {name: 'test1', conditions: [], path: ''},
            {
              name: 'test2',
              conditions: [],
              path: '',
              priority: -1,
            },
            {name: 'test3', conditions: [], path: ''},
            {name: 'test4', conditions: [], path: ''},
          ]),
          e: [
            {
              name: 'test1',
              conditions: [],
              path: '',
              priority: 0,
            },
            {
              name: 'test3',
              conditions: [],
              path: '',
              priority: 0,
            },
            {
              name: 'test4',
              conditions: [],
              path: '',
              priority: 0,
            },
            {
              name: 'test2',
              conditions: [],
              path: '',
              priority: -1,
            },
          ],
        },
      ];

      tests.forEach((test) => {
        expect(test.v).toStrictEqual(test.e);
      });
    });
  });

  describe('Query.classify()', () => {
    it('should return correct array of matches for Query.classify()', () => {
      const tests = [
        {
          v: Query.classify(['test1', 'test2'], []),
          e: [],
        },
        {
          v: Query.classify(
            ['test1', 'test2'],
            [{name: 'test1', conditions: [Query.or('test1')], path: ''}],
          ),
          e: [{name: 'test1', conditions: [Query.or('test1')], path: ''}],
        },
        {
          v: Query.classify(
            ['test1', 'test2'],
            [
              {
                name: 'test1',
                conditions: [Query.and('test1', 'test3')],
                path: '',
              },
            ],
          ),
          e: [],
        },
      ];

      tests.forEach((test) => {
        expect(test.v).toEqual(test.e);
      });
    });
  });
});
