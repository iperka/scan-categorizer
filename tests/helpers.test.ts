import { Helpers } from "../src/helpers";

describe("Helpers", () => {
  describe("populate()", () => {
    [
      { v: Helpers.populate("Test"), e: "Test" },
      { v: Helpers.populate("Test/$y", new Date("2022-04-01")), e: "Test/2022" },
      { v: Helpers.populate("Test/$y/$m", new Date("2022-03-01")), e: "Test/2022/03" },
      {
        v: Helpers.populate("Test/$y/$m/$name", new Date("2022-03-01"), { name: "Test" }),
        e: "Test/2022/03/Test",
      },
    ].forEach((test) => {
      it(`should return '${test.e}' for populate(${test.v})`, () => {
        expect(test.v).toEqual(test.e);
      });
    });

    it("should replace all date variables correctly", () => {
      const date = new Date("2022-03-15T14:30:45");
      const result = Helpers.populate("$y-$m-$d $h:$i:$s", date);
      expect(result).toBe("2022-03-15 14:30:45");
    });

    it("should replace last year variable $l correctly", () => {
      const date = new Date("2022-03-01");
      const result = Helpers.populate("Year/$l", date);
      expect(result).toBe("Year/2021");
    });

    it("should replace multiple occurrences of the same variable", () => {
      const date = new Date("2022-03-01");
      const result = Helpers.populate("$y/$y/$y", date);
      expect(result).toBe("2022/2022/2022");
    });

    it("should handle metadata with special characters", () => {
      const metadata = { company: "Test-Company_123" };
      const result = Helpers.populate("Files/$company", new Date(), metadata);
      expect(result).toBe("Files/Test-Company_123");
    });

    it("should prioritize longer variable names during replacement", () => {
      const metadata = { name: "John", names: "Multiple" };
      const result = Helpers.populate("$names/$name", new Date(), metadata);
      expect(result).toBe("Multiple/John");
    });
  });

  describe("isString()", () => {
    it("should return true for string values", () => {
      expect(Helpers.isString("test")).toBe(true);
      expect(Helpers.isString("")).toBe(true);
      expect(Helpers.isString("123")).toBe(true);
    });

    it("should return false for non-string values", () => {
      expect(Helpers.isString(123)).toBe(false);
      expect(Helpers.isString(null)).toBe(false);
      expect(Helpers.isString(undefined)).toBe(false);
      expect(Helpers.isString({})).toBe(false);
      expect(Helpers.isString([])).toBe(false);
      expect(Helpers.isString(true)).toBe(false);
    });
  });

  describe("isValidPath()", () => {
    it("should return true for valid paths", () => {
      expect(Helpers.isValidPath("Test/Path")).toBe(true);
      expect(Helpers.isValidPath("Invoices/$y/$m")).toBe(true);
      expect(Helpers.isValidPath("Documents/2022")).toBe(true);
    });

    it("should return false for paths that are too short", () => {
      expect(Helpers.isValidPath("a")).toBe(false);
      expect(Helpers.isValidPath("ab")).toBe(false);
      expect(Helpers.isValidPath("abc")).toBe(false);
    });

    it("should return false for paths with invalid characters", () => {
      expect(Helpers.isValidPath("Test\\Path")).toBe(false);
      expect(Helpers.isValidPath("Test:Path")).toBe(false);
      expect(Helpers.isValidPath("Test*Path")).toBe(false);
      expect(Helpers.isValidPath("Test?Path")).toBe(false);
      expect(Helpers.isValidPath('Test"Path')).toBe(false);
      expect(Helpers.isValidPath("Test<Path")).toBe(false);
      expect(Helpers.isValidPath("Test>Path")).toBe(false);
      expect(Helpers.isValidPath("Test|Path")).toBe(false);
    });

    it("should return false for null or undefined", () => {
      expect(Helpers.isValidPath(null as any)).toBe(false);
      expect(Helpers.isValidPath(undefined as any)).toBe(false);
      expect(Helpers.isValidPath("")).toBe(false);
    });
  });

  describe("isValidPdfFileName()", () => {
    it("should return true for valid PDF file names", () => {
      expect(Helpers.isValidPdfFileName("document.pdf")).toBe(true);
      expect(Helpers.isValidPdfFileName("Invoice_2022.pdf")).toBe(true);
      expect(Helpers.isValidPdfFileName("test.PDF")).toBe(true);
      expect(Helpers.isValidPdfFileName("file.Pdf")).toBe(true);
    });

    it("should return false for non-PDF file names", () => {
      expect(Helpers.isValidPdfFileName("document.txt")).toBe(false);
      expect(Helpers.isValidPdfFileName("document.doc")).toBe(false);
      expect(Helpers.isValidPdfFileName("document")).toBe(false);
      expect(Helpers.isValidPdfFileName("")).toBe(false);
    });

    it("should return false for null or undefined", () => {
      expect(Helpers.isValidPdfFileName(null as any)).toBe(false);
      expect(Helpers.isValidPdfFileName(undefined as any)).toBe(false);
    });
  });

  describe("sanitizeFileName()", () => {
    it("should replace invalid characters with underscores", () => {
      expect(Helpers.sanitizeFileName("test:file.pdf")).toBe("test_file.pdf");
      expect(Helpers.sanitizeFileName("test*file?.pdf")).toBe("test_file.pdf");
      expect(Helpers.sanitizeFileName("test\\file/name.pdf")).toBe("test_file_name.pdf");
    });

    it("should remove multiple consecutive underscores", () => {
      expect(Helpers.sanitizeFileName("test___file.pdf")).toBe("test_file.pdf");
      expect(Helpers.sanitizeFileName("test::file.pdf")).toBe("test_file.pdf");
    });

    it("should remove leading and trailing underscores", () => {
      expect(Helpers.sanitizeFileName("_test.pdf")).toBe("test.pdf");
      expect(Helpers.sanitizeFileName("test_.pdf")).toBe("test.pdf");
      expect(Helpers.sanitizeFileName("_test_file_.pdf")).toBe("test_file.pdf");
    });

    it("should add .pdf extension if missing", () => {
      expect(Helpers.sanitizeFileName("document")).toBe("document.pdf");
      expect(Helpers.sanitizeFileName("test.txt")).toBe("test.txt.pdf");
    });

    it("should preserve existing .pdf extension", () => {
      expect(Helpers.sanitizeFileName("document.pdf")).toBe("document.pdf");
    });

    it("should return default name for empty or invalid input", () => {
      expect(Helpers.sanitizeFileName("")).toBe("untitled.pdf");
      expect(Helpers.sanitizeFileName(null as any)).toBe("untitled.pdf");
      expect(Helpers.sanitizeFileName(undefined as any)).toBe("untitled.pdf");
    });

    it("should handle files with only invalid characters", () => {
      expect(Helpers.sanitizeFileName("***:::.pdf")).toBe("untitled.pdf");
    });
  });

  describe("formatDate()", () => {
    it("should format date correctly", () => {
      expect(Helpers.formatDate(new Date("2022-03-15"))).toBe("2022-03-15");
      expect(Helpers.formatDate(new Date("2022-01-01"))).toBe("2022-01-01");
      expect(Helpers.formatDate(new Date("2022-12-31"))).toBe("2022-12-31");
    });

    it("should pad single digit months and days with zeros", () => {
      expect(Helpers.formatDate(new Date("2022-03-05"))).toBe("2022-03-05");
      expect(Helpers.formatDate(new Date("2022-01-09"))).toBe("2022-01-09");
    });
  });

  describe("extractDateFromFileName()", () => {
    it("should extract valid dates from file names", () => {
      const date1 = Helpers.extractDateFromFileName("Invoice_2022-03-15.pdf");
      expect(date1).toEqual(new Date(2022, 2, 15));

      const date2 = Helpers.extractDateFromFileName("2021-12-31_document.pdf");
      expect(date2).toEqual(new Date(2021, 11, 31));
    });

    it("should return null for file names without dates", () => {
      expect(Helpers.extractDateFromFileName("document.pdf")).toBeNull();
      expect(Helpers.extractDateFromFileName("invoice_march.pdf")).toBeNull();
    });

    it("should return null for invalid dates", () => {
      expect(Helpers.extractDateFromFileName("2022-13-01.pdf")).toBeNull();
      expect(Helpers.extractDateFromFileName("2022-02-30.pdf")).toBeNull();
    });

    it("should return null for empty or invalid input", () => {
      expect(Helpers.extractDateFromFileName("")).toBeNull();
      expect(Helpers.extractDateFromFileName(null as any)).toBeNull();
      expect(Helpers.extractDateFromFileName(undefined as any)).toBeNull();
    });

    it("should extract first date if multiple dates exist", () => {
      const date = Helpers.extractDateFromFileName("2022-01-15_backup_2022-02-20.pdf");
      expect(date).toEqual(new Date(2022, 0, 15));
    });
  });
});
