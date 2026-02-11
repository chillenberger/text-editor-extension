import { FileExtractor, File } from "../services/fileExtractor";
import * as fs from "fs";
import * as path from "path";
import assert from 'node:assert/strict';

describe("FileExtractor PDF Reader", function () {
  it("should extract text from an Excel file", async function () {
    // Path to a sample Excel file in the test directory
    const excelPath = path.join(__dirname, "excel_test_sheet.xlsx");
    const data = fs.readFileSync(excelPath);
    
    const file: File = {
      name: "excel_test_sheet.xlsx",
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      data: new Uint8Array(data),
    };
    const extractor = new FileExtractor();
    const text = await extractor.extract(file);
    console.log("text: ", text);

    const expectedStart = "Test Page   This   is   a   Portable";
    assert(text.includes(expectedStart), `Extracted text does not contain expected content. Extracted text: ${text}`);
  });
});
