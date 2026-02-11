import { FileExtractor, File } from "../services/fileExtractor";
import * as fs from "fs";
import * as path from "path";
import assert from 'node:assert/strict';

describe("FileExtractor PDF Reader", function () {
  it("should extract text from a PDF file", async function () {
    // Path to a sample PDF file in the test directory
    const pdfPath = path.join(__dirname, "pdf_test_page.pdf");

    const data = fs.readFileSync(pdfPath);
    const file: File = {
      name: "pdf_test_page.pdf",
      type: "application/pdfText",
      data: new Uint8Array(data),
    };
    const extractor = new FileExtractor();
    const text = await extractor.extract(file);
    const expectedStart = "Test Page   This   is   a   Portable";
    assert(text.includes(expectedStart), `Extracted text does not contain expected content. Extracted text: ${text}`);
  });
});
