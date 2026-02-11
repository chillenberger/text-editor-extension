
import PDFParser from "pdf2json";
import { read, utils } from "xlsx"

export interface File {
  name: string;
  type: string;
  data: Uint8Array;
}

export interface FileHandler {
  (file: File): Promise<string>;
}

export class FileExtractor {
  private handler: Map<string, FileHandler> = new Map();

  constructor() {
    this.registerDefaultHandlers();
  }

  private registerDefaultHandlers() {
    this.register("application/pdfText", this.handlePDFText.bind(this));
    this.register("text/plain", this.handleTextFile.bind(this));
    this.register("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", this.handleExcelFile.bind(this));
    this.register("application/vnd.ms-excel", this.handleExcelFile.bind(this));
  }

  private register(mimeType: string, handler: FileHandler) {
    this.handler.set(mimeType, handler);
  }

  extract(file: File): Promise<string> {
    const handler = this.handler.get(file.type);
    if (handler) {
      return handler(file);
    } else {
      return Promise.reject(`No handler for file type: ${file.type}`);
    }
  }

  private async handlePDFText(file: File): Promise<string> {
      return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser();

        pdfParser.on("pdfParser_dataError", (errData: any) => {
          reject(errData.parserError);
        });

        pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
          console.log("PDF data ready");
          try {
            const pages = pdfData?.Pages || [];
            const text = pages.map((page: any) =>
              page.Texts.map((textObj: any) =>
                decodeURIComponent(textObj.R.map((r: any) => r.T).join(""))
              ).join(" ")
            ).join("\n");
            resolve(text);
          } catch (e) {
            reject(e);
          }
        });

        pdfParser.parseBuffer(Buffer.from(file.data));
      });
  }

  private async handleExcelFile(file: File): Promise<string> {
    const workbook = read(Buffer.from(file.data), { type: 'buffer' });
    let worksheets = Array<Array<JSON>>();
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const sheetJSON: Array<JSON> = utils.sheet_to_json(worksheet, { header: 1 });
      worksheets.push(sheetJSON);
    });
    return JSON.stringify(worksheets);
  }

  private async handleTextFile(file: File): Promise<string> {
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(file.data);
  }

  getFileType(path: string): string | null {
    const extension = path.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return 'application/pdfText';
      case 'txt':
        return 'text/plain';
      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'xls':
        return 'application/vnd.ms-excel';
      default:
        return null;
    }
  }
}