import { google } from 'googleapis';

interface AttendanceData {
  timestamp: string;
  fullName: string;
  church?: string;
  checkInTime: string;
  method: string;
  checkedInBy?: string;
  eventName?: string;
  notes?: string;
}

export class GoogleSheetsService {
  private static sheetsClient: any;
  private static isInitialized = false;

  static async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('[GoogleSheetsService] Initializing...');
      let credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
      if (!credentials) {
        console.warn('[GoogleSheetsService] GOOGLE_SERVICE_ACCOUNT_KEY not set, Google Sheets integration disabled');
        return;
      }

      // Clean up the credentials string
      credentials = credentials.trim();
      
      // Remove surrounding single quotes if present
      if (credentials.startsWith("'") && credentials.endsWith("'")) {
        credentials = credentials.slice(1, -1).trim();
      }
      // Remove surrounding double quotes if present
      if (credentials.startsWith('"') && credentials.endsWith('"')) {
        credentials = credentials.slice(1, -1).trim();
      }

      // Try to parse as JSON
      const parsedCredentials = JSON.parse(credentials);
      console.log('[GoogleSheetsService] Credentials parsed successfully.');

      const auth = new google.auth.JWT({
        email: parsedCredentials.client_email,
        key: parsedCredentials.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      await auth.authorize();

      this.sheetsClient = google.sheets({ version: 'v4', auth });
      this.isInitialized = true;
      console.log('[GoogleSheetsService] Google Sheets service initialized successfully.');
    } catch (error) {
      console.error('[GoogleSheetsService] Failed to initialize Google Sheets service:', error);
    }
  }

  /**
   * Ensure that a sheet (tab) exists with the given name, and has the correct headers
   */
  private static async ensureSheetAndHeaders(sheetName: string): Promise<void> {
    if (!this.sheetsClient) {
      console.warn(`[GoogleSheetsService] sheetsClient not available for sheet "${sheetName}", skipping ensureSheetAndHeaders.`);
      return;
    }

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      console.warn(`[GoogleSheetsService] GOOGLE_SHEET_ID not set for sheet "${sheetName}", skipping ensureSheetAndHeaders.`);
      return;
    }
    console.log(`[GoogleSheetsService] Ensuring sheet and headers for spreadsheetId: ${spreadsheetId}, sheetName: "${sheetName}"`);

    try {
      // First, get all sheet titles to see if our target sheet exists
      const spreadsheet = await this.sheetsClient.spreadsheets.get({
        spreadsheetId,
      });

      const sheets = spreadsheet.data.sheets || [];
      let targetSheetId: number | undefined;

      for (const sheet of sheets) {
        if (sheet.properties?.title === sheetName) {
          targetSheetId = sheet.properties.sheetId;
          console.log(`[GoogleSheetsService] Sheet "${sheetName}" found with ID: ${targetSheetId}`);
          break;
        }
      }

      // If sheet doesn't exist, create it
      if (!targetSheetId) {
        console.log(`[GoogleSheetsService] Sheet "${sheetName}" not found, creating new sheet.`);
        const createRequest = await this.sheetsClient.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: sheetName,
                  },
                },
              },
            ],
          },
        });

        targetSheetId = createRequest.data.replies?.[0]?.addSheet?.properties?.sheetId;
        console.log(`[GoogleSheetsService] Sheet "${sheetName}" created with ID: ${targetSheetId}`);
      }

      // Now check if headers are present in this sheet
      const headerRange = `${sheetName}!A1:H1`;
      const headerResponse = await this.sheetsClient.spreadsheets.values.get({
        spreadsheetId,
        range: headerRange,
      });

      const headers = headerResponse.data.values;
      if (!headers || headers.length === 0) {
        console.log(`[GoogleSheetsService] Headers not found for sheet "${sheetName}", writing headers.`);
        // Write headers
        const headerValues = [
          [
            'Timestamp',
            'Full Name',
            'Church',
            'Check-in Time',
            'Check-in Method',
            'Checked In By',
            'Event Name',
            'Notes',
          ],
        ];

        await this.sheetsClient.spreadsheets.values.update({
          spreadsheetId,
          range: headerRange,
          valueInputOption: 'RAW',
          requestBody: {
            values: headerValues,
          },
        });

        console.log(`[GoogleSheetsService] Headers created for sheet: ${sheetName}`);
      } else {
        console.log(`[GoogleSheetsService] Headers already present for sheet: ${sheetName}`);
      }
    } catch (error) {
      console.error(`[GoogleSheetsService] Failed to ensure sheet or headers for "${sheetName}":`, error);
    }
  }

  static async appendAttendance(data: AttendanceData): Promise<void> {
    console.log('[GoogleSheetsService] Attempting to append attendance data:', data);
    if (!this.isInitialized) {
      console.log('[GoogleSheetsService] Service not initialized, calling initialize().');
      await this.initialize();
    }

    if (!this.sheetsClient) {
      console.warn('[GoogleSheetsService] Google Sheets client not available after initialization, skipping append.');
      return;
    }

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      console.warn('[GoogleSheetsService] GOOGLE_SHEET_ID not set, skipping append.');
      return;
    }

    // Use event name as sheet name, default to "Attendance"
    const sheetName = data.eventName?.trim() || 'Attendance';
    console.log(`[GoogleSheetsService] Appending to spreadsheetId: ${spreadsheetId}, sheetName: "${sheetName}"`);

    try {
      // First ensure the sheet exists and has headers
      await this.ensureSheetAndHeaders(sheetName);

      const values = [
        [
          data.timestamp,
          data.fullName,
          data.church || '',
          data.checkInTime,
          data.method,
          data.checkedInBy || '',
          data.eventName || '',
          data.notes || '',
        ],
      ];
      console.log('[GoogleSheetsService] Values to append:', values);

      await this.sheetsClient.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:H`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values,
        },
      });

      console.log(`[GoogleSheetsService] Attendance data appended to sheet: ${sheetName}`);
    } catch (error) {
      console.error(`[GoogleSheetsService] Failed to append attendance to sheet "${sheetName}":`, error);
    }
  }
}
