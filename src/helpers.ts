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
}
