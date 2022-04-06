/* eslint-disable no-unused-vars */
import {Helpers} from './helpers';
import {Query} from './query';

/**
 * Categorizes all files in the given directories based on given categories.
 *
 * @author Michael Beutler
 * @param {Query.Category[]} categories Array of categories.
 * @param {string[]} src Array of source folder ID's.
 */
function categorize(categories: Query.Category[], src: string[]): void {
  // Check if categories are valid.
  if (!categories || categories.length < 1) {
    throw new Error(
      'Categories is not defined. The script will be terminated.',
    );
  }

  // Check if source folders are valid.
  if (!src || categories.length < 1) {
    throw new Error('Source is not defined. The script will be terminated.');
  }

  Logger.log('Categorizing...');
  ScanCategorizer.run(categories, src);
  Logger.log('Categorizing done.');
}

/**
 * Shortcut function to build and conditions.
 *
 * @author Michael Beutler
 * @param {string[]} values Array of strings or regexes.
 * @return {Query.Condition} And condition object.
 */
function and(...values: (string | RegExp)[]): Query.Condition {
  return Query.and(...values);
}

/**
 * Shortcut function to build or conditions.
 *
 * @author Michael Beutler
 * @param {string[]} values Array of strings or regexes.
 * @return {Query.Condition} Or condition object.
 */
function or(...values: (string | RegExp)[]): Query.Condition {
  return Query.or(...values);
}

namespace ScanCategorizer {
  /**
   * Main entry point for the script.
   *
   * @author Michael Beutler
   * @param {Query.Category[]} categories Array of categories.
   * @param {string[]} src Array of source folder ID's.
   * @param {boolean} debug Flag to enable debug mode.
   * @return {void}
   */
  export const run = (
    categories: Query.Category[],
    src: string[],
    debug: boolean = false,
  ): void => {
    // Validate the libraries that are used in the script.
    Helpers.validateLibraries();

    for (const category of categories) {
      // Check if conditions are valid.
      if (category.conditions.length <= 0) {
        throw new Error(
          `Category with name ${category.name} must have at least one condition!`,
        );
      }

      // Check if path is valid.
      if (category.path.length < 4) {
        throw new Error(
          `Category with name ${category.name} is invalid due to path length!`,
        );
      }

      // Check if rename is set.
      if (category.rename) {
        // Evaluate new file name.
        const rename =
          typeof category.rename === 'string'
            ? category.rename
            : category.rename({getName: () => 'TEMP'} as any);

        // Check if rename is valid.
        if (!/\.pdf$/.test(rename)) {
          throw new Error(
            `Category with name ${category.name} is invalid, every rename property must end with '.pdf' to be able to categorize it!`,
          );
        }
      }

      // Check if priority is set and is valid.
      if (category.priority && typeof category.priority !== 'number') {
        throw new Error(
          `Category with name ${category.name} is invalid, priority must be a number!`,
        );
      }
    }

    // Get the IDs of the source folders and iterate over them.
    const sourceFolders: GoogleAppsScript.Drive.Folder[] = src.map((id) => {
      try {
        return DriveApp.getFolderById(id);
      } catch (error) {
        Logger.log(
          'An error occurred while getting the source folder: ' + error,
        );
        return null;
      }
    });

    if (sourceFolders.includes(null)) {
      throw new Error(
        'One or more source folders are invalid or are not accessible! The script has been terminated.',
      );
    }

    const fileIterators: GoogleAppsScript.Drive.FileIterator[] = [
      ...sourceFolders.map((folder) =>
        folder.getFilesByType('application/pdf'),
      ), // Get all PDF files.
    ];

    // Iterate over all files in all source folders.
    fileIterators.forEach((fileIterator) => {
      while (fileIterator.hasNext()) {
        const file = fileIterator.next();
        Logger.log('Processing file: ' + file.getName());

        const text = Helpers.extractTextFromPDF(file);
        const words = text.split(' ');
        Logger.log('Found ' + words.length + ' words.');
        if (debug) {
          Logger.log('Extracted text: ' + text);
        }

        const matches = Query.classify(words, categories);

        // Check if the file matches any category.
        if (matches.length === 0) {
          // Handle missing category
          Logger.log(
            `The file ${file.getName()} doesn't match any configured category.`,
          );
          continue;
        }

        Logger.log(
          'Matched categories: ' + matches.map((c) => c.name).join(', '),
        );

        // Sort the matches by priority.
        const sorted = Query.sortMatchesByPriority(matches);

        // Handle first category matched.
        Logger.log('Apply category: ' + sorted[0].name);
        handleMatch(file, sorted[0]);

        for (let i = 1; i < sorted.length; i++) {
          const category = sorted[i];

          // Check if category allows for secondary categorization.
          if (!category.allowSecondary) {
            Logger.log(
              `Category ${category.name} is not allowed to be a secondary category and will be skipped.`,
            );

            // Skip
            continue;
          }

          Logger.log('Creating shortcuts for category: ' + category.name);
          handleMatch(file, category, true);
        }

        Logger.log('Finished processing file: ' + file.getName());
      }
    });
  };

  const handleMatch = (
    file: GoogleAppsScript.Drive.File,
    category: Query.Category,
    onlyShortcut?: boolean,
  ) => {
    const date: Date = new Date(file.getDateCreated().getTime());

    // Check if custom name is defined.
    const name =
      category.rename !== undefined
        ? typeof category.rename === 'string'
          ? Helpers.populate(category.rename, date)
          : category.rename(file)
        : file.getName();

    if (!/\.pdf$/.test(name)) {
      throw new Error(
        "The file name must end with '.pdf' to be able to categorize it!",
      );
    }

    if (onlyShortcut) {
      Helpers.createShortcut(
        file.getId(),
        name,
        Helpers.populate(category.path, date),
      );
    } else {
      file.setName(name);
      file.moveTo(
        Helpers.getOrCreateFolder(Helpers.populate(category.path, date)),
      );
      Logger.log(
        `Moved ${file.getName()} to ${Helpers.populate(category.path, date)}.`,
      );
    }

    if (category.shortcuts) {
      category.shortcuts.forEach((shortcut) =>
        Helpers.createShortcut(
          file.getId(),
          name,
          Helpers.populate(shortcut, date),
        ),
      );
    }
  };
}
