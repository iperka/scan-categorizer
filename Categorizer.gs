/**
 * Scan Cateogrizer Script
 * 
 * Allows to save all scans into one folder and let the script
 * analyize the contents and move file into specific folder by
 * category.
 * 
 * @version 1.2.2
 * @author Michael Beutler
 */


/**
 * Define scan folder id, this defines where the scripts searches for PDFs to categorize.
 */
const SCAN_FOLDER_ID = "YOUR_FOLDER_ID";

/**
 * Define email to get reports of failed executions.
 */
const REPORT_EMAIL = "you@example.com";

/**
 * Define categories and the path to save.
 * Combine path with path variables like year, month and day.
 * 
 * $y => year
 * $m => month
 * $d => date
 * $h => hour
 * $i => minutes
 * $s => seconds
 * 
 * Advanced:
 * Add a custom rename function to rename file based on contents.
 * 
 * {
 *  ...
 *  rename: function(document) {
 *    // File ID
 *    Logger.log(document.id);
 * 
 *    // Current Filename
 *    Logger.log(document.name);
 * 
 *    // Text contents
 *    Logger.log(document.text);
 * 
 *    // Creation date
 *    Logger.log(document.date);
 * 
 *    // Return new filename
 *    return "new filename";
 *  }
 * }
 * 
 */
const CATEGORIES = [
  {
    name: "Foo",
    keywords: ["Foo", "Bar"],
    path: "Foo/Bar/$y/$m"
  },
    {
    name: "Bar",
    keywords: ["Bar"],
    path: "Bar/Foo/$y/$m"
  }
]






// ==================================================================================
// ======================= BELOW THIS ARE NO CHANGES REQUIRED =======================
// ==================================================================================


function main() {
  getPDFs()
}

function getPDFs() {
  const folder = DriveApp.getFolderById(SCAN_FOLDER_ID);
  const files = folder.getFilesByType("application/pdf");

  if (!files.hasNext()) {
    Logger.log(`No files found inside target folder.`);
    return;
  }

  while (files.hasNext()) {
    let file = files.next();
    let fileID = file.getId();

    const doc = getTextFromPDF(fileID);
    const matches = getCategory(doc.text);

    if (matches.length > 1 || matches.length < 1) {
      Logger.log(`Unable to determinate categry. (${matches.length})`);
      GmailApp.sendEmail(REPORT_EMAIL, `Document inside '${folder.getName()}' can't be categorized.`, `
        The document '${file.getName()}' couldn't be categorized by script.\n
        If you encounter this problem more than once you should adjust the CATEGORIES inside the script to match your document.\n
        \n
        ${file.getUrl()}\n
      `, {
        noReply: true, htmlBody: `
        The document '${file.getName()}' couldn't be categorized by script.<br />
        If you encounter this problem more than once you should adjust the CATEGORIES to match your document.<br />
        <br />
        <a href="${file.getUrl()}">${file.getName()}</a><br />
      ` });

      continue;
    }

    const match = matches.pop();
    Logger.log(`Document categorized as '${match.name}'.'`);

    moveFiles(file.getId(), match, doc);
  }
}

function getTextFromPDF(fileID) {
  var blob = DriveApp.getFileById(fileID).getBlob()
  var resource = {
    title: blob.getName(),
    mimeType: blob.getContentType()
  };
  var options = {
    ocr: true,
    ocrLanguage: "de"
  };
  // Convert the pdf to a Google Doc with ocr.
  var file = Drive.Files.insert(resource, blob, options);

  // Get the texts from the newly created text.
  var doc = DocumentApp.openById(file.id);
  var text = doc.getBody().getText();
  var title = doc.getName();

  // Deleted the document once the text has been stored.
  Drive.Files.remove(doc.getId());

  return {
    id: file.id,
    name: title,
    text: text,
    date: new Date(file.createdDate)
  };
}

function getCategory(text) {
  const matches = [];
  CATEGORIES.forEach(category => {
    for (let i = 0; i < category.keywords.length; i++) {
      const keyword = category.keywords[i];
      if (text.toLowerCase().includes(keyword.toLowerCase())) {
        matches.push(category);
        i = category.keywords.length;
      }
    }
  })

  return matches;
}

function createFilename(filename, info) {
  var keys = Object.keys(info);
  keys.sort(function (a, b) {
    return b.length - a.length;
  });

  for (var i = 0; i < keys.length; i++) {
    filename = filename.replace(new RegExp('\\$' + keys[i], 'g'), info[keys[i]]);
  }
  return filename;
}

function moveFiles(sourceFileId, category, document) {
  const date = new Date();
  const info = {
    'name': category.name,
    'y': ('0000' + (date.getFullYear())).slice(-4),
    'm': ('00' + (date.getMonth() + 1)).slice(-2),
    'd': ('00' + (date.getDate())).slice(-2),
    'h': ('00' + (date.getHours())).slice(-2),
    'i': ('00' + (date.getMinutes())).slice(-2),
    's': ('00' + (date.getSeconds())).slice(-2)
  }
  const path = createFilename(category.path, info);

  const file = DriveApp.getFileById(sourceFileId);

  // Check if custom name function given
  if (category.rename) {
    Logger.log(`Custom rename function for category '${category.name}' found.`)
    file.setName(category.rename(document));
    Logger.log(`New filename set to '${file.getName()}''.`)
  }

  const folder = getOrMakeFolder(path);
  file.moveTo(folder);
}

function getOrMakeFolder(path) {
  var folder = DriveApp.getRootFolder();
  var names = path.split('/');
  while (names.length) {
    var name = names.shift();
    if (name === '') continue;

    var folders = folder.getFoldersByName(name);
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = folder.createFolder(name);
    }
  }

  return folder;
}

