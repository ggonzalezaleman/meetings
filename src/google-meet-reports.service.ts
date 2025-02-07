import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleMeetReportsService {
  private readonly logger = new Logger(GoogleMeetReportsService.name);
  private reportsClient;
  private auth: JWT;

  constructor(private configService: ConfigService) {
    // Retrieve the service account key from environment variables.
    const serviceAccountKey = this.configService.get<string>('GOOGLE_SERVICE_ACCOUNT_KEY');
    if (!serviceAccountKey) {
      throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY in environment variables');
    }

    let keyFile;
    try {
      keyFile = JSON.parse(serviceAccountKey);
    } catch (error) {
      throw new Error('Invalid JSON format for GOOGLE_SERVICE_ACCOUNT_KEY');
    }

    // Retrieve the admin email used for domain-wide delegation.
    const adminEmail = this.configService.get<string>('GOOGLE_ADMIN_EMAIL');
    if (!adminEmail) {
      throw new Error('Missing GOOGLE_ADMIN_EMAIL in environment variables');
    }

    // Initialize the JWT client with the required audit scope.
    this.auth = new google.auth.JWT({
      email: keyFile.client_email,
      key: keyFile.private_key,
      scopes: ['https://www.googleapis.com/auth/admin.reports.audit.readonly'],
      subject: adminEmail,
    });

    // Create the Admin SDK Reports API client.
    this.reportsClient = google.admin({ version: 'reports_v1', auth: this.auth });
  }

  /**
   * Fetch Google Meet activities (audit log events) for a specified date.
   * This method paginates through all available results.
   * @param date A string representing the date in YYYY-MM-DD format.
   * @returns A promise resolving to an object containing all activities.
   */
  async fetchMeetActivities(date: string): Promise<any> {
    const startTime = `${date}T00:00:00Z`;
    const endTime = `${date}T23:59:59Z`;
    let allActivities = [];
    let pageToken: string | undefined = undefined;

    do {
      try {
        const response = await this.reportsClient.activities.list({
          userKey: 'all',
          applicationName: 'meet',
          startTime,
          endTime,
          pageToken,
        });

        if (response.data.items) {
          allActivities = allActivities.concat(response.data.items);
        }
        pageToken = response.data.nextPageToken;
      } catch (error) {
        this.logger.error('Error during pagination of Google Meet activities:', error);
        throw error;
      }
    } while (pageToken);

    this.logger.log(`Fetched ${allActivities.length} Google Meet activities for date: ${date}`);
    return {
      kind: 'admin#reports#activities',
      items: allActivities,
    };
  }
}
