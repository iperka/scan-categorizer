export namespace Helpers {
  /**
   * Replaces variables in a string with values from an object.
   * This includes date and metadata variables.
   *
   * Defined variables:
   * - `$y` = year (4 digits)
   * - `$m` = month (2 digits)
   * - `$d` = day (2 digits)
   * - `$h` = hour (2 digits)
   * - `$i` = minute (2 digits)
   * - `$s` = second (2 digits)
   * - `$...` = metadata variable
   *
   * @example ```ts
   * populate("Invoices/$y/$m/$d") => "Invoices/2020/01/01"
   * populate("Invoices/$y/$m/$d/test") => "Invoices/2020/01/01/test"
   * populate(
   *    "Invoices/$y/$m/$d/test", new Date("2022-03-01")
   * ) => "Invoices/2022/03/01/test"
   * populate(
   *    "Invoices/$y/$m/$d/$name", new Date("2022-03-01"), {name: "test"}
   * ) => "Invoices/2022/03/01/test"
   * ```
   *
   * @author Michael Beutler
   * @param {string[]} value Text with values to replace.
   * @param {Date} date Date used to replace values.
   * @param {object} metadata Additional metadata to replace values.
   * @return {string} Text with replaced values.
   */
  export const populate = (
    value: string,
    date: Date = new Date(),
    metadata: {} = {},
  ): string => {
    const info: {[keys: string]: string} = {
      y: ('0000' + date.getFullYear()).slice(-4),
      l: ('0000' + (date.getFullYear() - 1)).slice(-4),
      m: ('00' + (date.getMonth() + 1)).slice(-2),
      d: ('00' + date.getDate()).slice(-2),
      h: ('00' + date.getHours()).slice(-2),
      i: ('00' + date.getMinutes()).slice(-2),
      s: ('00' + date.getSeconds()).slice(-2),
      ...metadata,
    };

    const keys = Object.keys(info);
    keys.sort(function (a, b) {
      return b.length - a.length;
    });

    for (const element of keys) {
      value = value.replace(new RegExp('\\$' + element, 'g'), info[element]);
    }
    return value;
  };

  /**
   * Checks if given value is a string.
   *
   * @author Michael Beutler
   * @param {any} value Value to check if it is a string.
   * @return {boolean} True if value is a string, false otherwise.
   */
  export const isString = (value: any): boolean => typeof value === 'string';

  /**
   * Extracts text content from a PDF file by using Google Docs APIs.
   *
   * @author Michael Beutler
   * @param {GoogleAppsScript.Drive.File} pdf PDF file to convert to text.
   * @param {{language: string}} options Additional options for the conversion.
   * @return {string} Text of the PDF file as string.
   */
  export const extractTextFromPDF = (
    pdf: GoogleAppsScript.Drive.File,
    options?: {language: string},
  ): string => {
    const blob = pdf.getBlob();
    const resource = {
      title: blob.getName(),
      mimeType: blob.getContentType(),
    };

    // Enable the Advanced Drive API Service.
    const file = Drive.Files.insert(resource, blob, {
      ocr: true,
      ocrLanguage: options && options.language ? options.language : 'en',
    });

    // Extract Text from PDF file.
    const document = DocumentApp.openById(file.id);
    const text = document.getBody().getText();

    // Delete the temporary file.
    Drive.Files.remove(document.getId());

    return text;
  };

  /**
   * Creates a folder and subfolder(s) in the root folder.
   *
   * @author Michael Beutler
   * @param {string} path Path to the folder.
   * @return {GoogleAppsScript.Drive.Folder} Folder object.
   */
  export const getOrCreateFolder = (
    path: string,
  ): GoogleAppsScript.Drive.Folder => {
    let folder = DriveApp.getRootFolder();
    const names = path.split('/');
    while (names.length) {
      const name = names.shift();
      if (name === '') continue;

      const folders = folder.getFoldersByName(name);
      if (folders.hasNext()) {
        folder = folders.next();
      } else {
        folder = folder.createFolder(name);
      }
    }

    return folder;
  };

  /**
   * Creates a shortcut to given file in given path.
   *
   * @param {string} targetId File target ID.
   * @param {string} name Name of the shortcut.
   * @param {string} path Path to the shortcut.
   * @return {string} Shortcut object id.
   */
  export const createShortcut = (
    targetId: string,
    name: string,
    path: string,
  ): string => {
    const resource: GoogleAppsScript.Drive.Schema.File = {
      shortcutDetails: {targetId},
      title: name,
      mimeType: 'application/vnd.google-apps.shortcut',
    };

    const folder = getOrCreateFolder(path);
    if (folder) resource.parents = [{id: folder.getId()}];
    const shortcut = Drive.Files.insert(resource);

    Logger.log(`Created shortcut in '${path}'.`);
    return shortcut.id;
  };

  export const validateLibraries = (): void => {
    if (!Drive.Files) throw new Error('Drive library missing.');
    if (!DriveApp) throw new Error('DriveApp library missing.');
    if (!DocumentApp) throw new Error('DocumentApp library missing.');
    if (!GmailApp) throw new Error('GmailApp library missing.');
  };

  export const sendEmail = (
    email: string,
    subject: string,
    text: string,
    htmlBody: string,
  ) => {
    GmailApp.sendEmail(email, subject, text, {
      noReply: true,
      htmlBody,
    });
  };

  /**
   * Validates a path string for category configuration.
   * Ensures the path meets minimum requirements and doesn't contain invalid characters.
   *
   * @author Michael Beutler
   * @param {string} path Path string to validate.
   * @return {boolean} True if path is valid, false otherwise.
   */
  export const isValidPath = (path: string): boolean => {
    if (!path || typeof path !== 'string') return false;
    if (path.length < 4) return false;
    // Check for invalid characters (e.g., \, :, *, ?, ", <, >, |)
    if (/[\\:*?"<>|]/.test(path)) return false;
    return true;
  };

  /**
   * Validates a file name to ensure it has a .pdf extension.
   *
   * @author Michael Beutler
   * @param {string} fileName File name to validate.
   * @return {boolean} True if file name is valid and ends with .pdf.
   */
  export const isValidPdfFileName = (fileName: string): boolean => {
    if (!fileName || typeof fileName !== 'string') return false;
    return /\.pdf$/i.test(fileName);
  };

  /**
   * Sanitizes a file name by removing or replacing invalid characters.
   * Useful when generating file names from user input or document content.
   *
   * @author Michael Beutler
   * @param {string} fileName File name to sanitize.
   * @return {string} Sanitized file name.
   */
  export const sanitizeFileName = (fileName: string): string => {
    if (!fileName || typeof fileName !== 'string') return 'untitled.pdf';
    
    // Remove .pdf extension temporarily to work with the base name
    let baseName = fileName.replace(/\.pdf$/i, '');
    
    // Replace invalid characters with underscores
    baseName = baseName.replace(/[\\/:*?"<>|]/g, '_');
    
    // Remove multiple consecutive underscores
    baseName = baseName.replace(/_+/g, '_');
    
    // Remove leading/trailing underscores and spaces
    baseName = baseName.trim().replace(/^_+|_+$/g, '');
    
    // If base name is empty after sanitization, use default
    if (!baseName) return 'untitled.pdf';
    
    return baseName + '.pdf';
  };

  /**
   * Formats a date as YYYY-MM-DD string.
   * Useful for file naming and path generation.
   *
   * @author Michael Beutler
   * @param {Date} date Date to format.
   * @return {string} Formatted date string.
   */
  export const formatDate = (date: Date = new Date()): string => {
    const year = ('0000' + date.getFullYear()).slice(-4);
    const month = ('00' + (date.getMonth() + 1)).slice(-2);
    const day = ('00' + date.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
  };

  /**
   * Extracts a date from a file name if it contains a date in YYYY-MM-DD format.
   *
   * @author Michael Beutler
   * @param {string} fileName File name to extract date from.
   * @return {Date | null} Extracted date or null if no valid date found.
   */
  export const extractDateFromFileName = (fileName: string): Date | null => {
    if (!fileName || typeof fileName !== 'string') return null;
    
    const dateMatch = fileName.match(/[1-2][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]/);
    if (!dateMatch) return null;
    
    const dateParts = dateMatch[0].split('-');
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1; // Month is 0-indexed
    const day = parseInt(dateParts[2]);
    
    const date = new Date(year, month, day);
    
    // Validate the date is real
    if (
      date.getFullYear() === year &&
      date.getMonth() === month &&
      date.getDate() === day
    ) {
      return date;
    }
    
    return null;
  };
}
