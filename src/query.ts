export namespace Query {
  export const enum Priority {
    LOW = -1,
    DEFAULT = 0,
    HIGH = 1,
  }

  export interface Condition {
    type: 'and' | 'or';
    values: (RegExp | string)[];
  }

  /**
   * Interface for a category.
   */
  export interface Category {
    /**
     * Name of the category.
     */
    name: string;

    /**
     * Array of conditions to check.
     */
    conditions: Condition[];

    /**
     * Path to the category.
     */
    path: string;

    /**
     * Optional priority of the category.
     */
    priority?: number;

    /**
     * Optional array of shortcuts to the category.
     */
    shortcuts?: string[];

    /**
     * Optional custom rename function.
     */
    rename?: ((document: GoogleAppsScript.Drive.File) => string) | string;
  }

  /**
   * Shortcut function to build or conditions.
   *
   * @author Michael Beutler
   * @param {string[]} values Array of strings or regexes.
   * @return {Condition} Or condition object.
   */
  export const or = (...values: (string | RegExp)[]): Condition => ({
    type: 'or',
    values,
  });

  /**
   * Shortcut function to build and conditions.
   *
   * @author Michael Beutler
   * @param {string[]} values Array of strings or regexes.
   * @return {Condition} And condition object.
   */
  export const and = (...values: (string | RegExp)[]): Condition => ({
    type: 'and',
    values,
  });

  /**
   * Cleans a list of words. This means all words are lowercased and
   * all words are trimmed.
   *
   * @param {string[]} words Array of words to clean.
   * @return {string[]} Cleaned array of words.
   */
  export const cleanWords = (words: (RegExp | string)[]) =>
    words
      .map((w) => (typeof w === 'string' ? w.toLowerCase().trim() : w))
      .filter((w) => (typeof w === 'string' ? w.length > 0 : true));

  /**
   * Checks if array of words applies to a condition.
   *
   * @author Michael Beutler
   * @param {string[]} words Words to check if condition applies.
   * @param {Condition} condition Condition to check.
   * @return {boolean} True if condition applies, false otherwise.
   */
  export const applies = (words: string[], condition: Condition): boolean => {
    // Clean words and condition values.
    const cleanedWords = cleanWords(words);
    const cleanedValues = cleanWords(condition.values);

    switch (condition.type) {
      case 'and':
        // Iterates over all values and checks if all of them matches.
        for (let i = 0; i < cleanedValues.length; i++) {
          const value = cleanedValues[i];
          if (typeof value === 'string') {
            if (!cleanedWords.includes(value)) {
              return false;
            }
          } else {
            if (!(value as RegExp).test(cleanedWords.join(' '))) {
              return false;
            }
          }
        }
        return true;

      default:
        // Iterates over all values and checks if any of them matches.
        for (let i = 0; i < cleanedValues.length; i++) {
          const value = cleanedValues[i];
          if (typeof value === 'string') {
            if (cleanedWords.includes(value)) {
              return true;
            }
          } else {
            if ((value as RegExp).test(cleanedWords.join(' '))) {
              return true;
            }
          }
        }
        return false;
    }
  };

  /**
   * Classifies a document by its content.
   *
   * @example ```ts
   * classify(
   * ["lorem", "dolor", "sit", "amet"],
   * [
   *   { name: "Lorem", conditions: [and("lorem", "ipsum")], path: "Lorem/$y" },
   *   { name: "Ipsum", conditions: [and("ipsum", "dolor")], path: "Ipsum/$y" },
   * ]
   * ); => [{name: "Lorem", conditions: [and("lorem", "ipsum")], path: "Lorem/$y"}]
   * ```
   *
   * @remarks This function is often used with the `sortMatchesByPriority` function.
   *
   * @author Michael Beutler
   * @param {string[]} words Array of words to search for.
   * @param {Category[]} categories Array of categories to search in.
   * @return {Category[]} List of matched categories.
   */
  export const classify = (
    words: string[],
    categories: Category[],
  ): Category[] => {
    const matches: Category[] = [];
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      const evaluatedConditions: boolean[] = [];
      for (let j = 0; j < category.conditions.length; j++) {
        const condition = category.conditions[j];
        evaluatedConditions.push(applies(words, condition));
      }

      if (evaluatedConditions.includes(false)) {
        continue;
      }
      matches.push(category);
    }

    return matches;
  };

  /**
   * Sorts categories by priority.
   * If no priority is set, the default priority is used.
   *
   * @author Michael Beutler
   * @param {Category[]} matches Array of categories.
   * @return {Category[]} Sorted list of categories.
   */
  export const sortMatchesByPriority = (matches: Category[]): Category[] => {
    return matches.sort((a: Category, b: Category) => {
      if (!a.priority) {
        a.priority = Priority.DEFAULT;
      }
      if (!b.priority) {
        b.priority = Priority.DEFAULT;
      }
      if (a.priority > b.priority) {
        return -1;
      }
      if (a.priority < b.priority) {
        return 1;
      }
      return 0;
    });
  };
}
