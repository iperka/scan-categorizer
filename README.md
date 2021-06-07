# Scan Categorizer 🏸

Google Script for better scan workflow. This script allows you to categorize scanned documents with predefined categories and organize your Drive.
The script uses OCR to check if one or more of the given keywords are included in the document and if only one category is matched it will organize according to configuration.

**Scan and forget!**

## Table of Contents 🧾

- [Scan Categorizer 🏸](#scan-categorizer-)
  - [Table of Contents 🧾](#table-of-contents-)
  - [Current Workflow ⏳](#current-workflow-)
  - [Workflow with Scan Categorizer 🎉](#workflow-with-scan-categorizer-)
  - [Installation 🎈](#installation-)
  - [Configuration ⚙](#configuration-)
    - [SCAN_FOLDER_ID](#scan_folder_id)
    - [REPORT_EMAIL](#report_email)
    - [CATEGORIES](#categories)
  - [Usage 🚀](#usage-)
  - [Authors 👨‍💻](#authors-)
  - [License 📃](#license-)
  - [Contributing 🤝](#contributing-)

## Current Workflow ⏳

![Current Workflow](https://github.com/iperka/scan-categorizer/blob/main/current-flow.png "Current Workflow")

- Scan your document with any scanner.
- Upload into Google Drive folder.
- Check files if multiple scanns made at once.
- Organize documents and navigate throw whole Google Drive.
- Handle the next document.

```javascript
while (true) {
  scanDocument();
  uploadDocument();
  if (isMultiScan) {
    checkDocuments();
    derterminateCategoryAndLocation();
  }
  organizeDocuments();
}
```

## Workflow with Scan Categorizer 🎉

With the use of this script you can save a significant amount of time navigating throw your folders and analizing PDF's. Just scan and forget!

- Scan your document with any scanner.
- Upload into Google Drive folder. (SwiftScan can automatically upload into folder!)
- Done! The Script will handle the rest for you.

## Installation 🎈

Create a new [Google Script](https://script.google.com/) Project within your Google Account. (If App Script is not enabled for your account ask your administrator or switch the account.) When created the project should open an editor. Edit the `Code.gs` and paste the script you downloaded.

Add the `Drive` and `Gmail` service to the project and hit `Run`. The script should ask for permission. Grant the required permissions and test the script.

It's recommended to test your configuration before creating a `Trigger`.

## Configuration ⚙

Adjust the values to your needs.

### SCAN_FOLDER_ID

The script will only handle PDFs inside the given folder. Define your input folder.

```js
const SCAN_FOLDER_ID = "1ZNbdXdDdOd-djdedxd9dod1dLdrdwdFd";
```

### REPORT_EMAIL

Whenever a document can't be categorized due to missing keywords or more than one matched category, you will get notified via email.

```js
const REPORT_EMAIL = "your-email@example.com";
```

### CATEGORIES

This option defines the categories. Every PDF document that includes one or more of the defined `keywords` will be matched and will apply the category. The `rename` property is optional and can be used to rename the name of the document as required. The extension must be included and must always return a filename or throw an `Error`.

```js
const CATEGORIES = [
  {
    name: "Foo Bar",
    keywords: ["foo", "bar"],
    path: "Foo/Bar/$y/$m",
    rename: function (document) {
      // File ID
      Logger.log(document.id);

      // Current Filename
      Logger.log(document.name);

      // Text contents
      Logger.log(document.text);

      // Creation date
      Logger.log(document.date);

      // Return new filename
      return "new filename";
    },
  },
];
```

## Usage 🚀

Be sure to configure the script accordingly before using it.

- Scan a document with your scanner or favorite scanner app. (SwiftScan is recommend)
- Upload your PDF document to Google Drive into the defined Scanner folder.
- Manually or automatically trigger script and all the documents will get categorized and organized.

## Authors 👨‍💻

- **Michael Beutler** - _Initial work_ - [MichaelBeutler](https://github.com/MichaelBeutler)

## License 📃

[MIT](https://choosealicense.com/licenses/mit/)

## Contributing 🤝

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate and meet the quality gate requirements.
