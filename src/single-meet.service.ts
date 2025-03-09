import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

@Injectable()
export class SingleMeetService {
  private readonly logger = new Logger(SingleMeetService.name);
  private reportsClient;
  private auth: JWT;

  constructor(private readonly configService: ConfigService) {
    // Retrieve the service account key from environment variables
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

    // Retrieve the admin email used for domain-wide delegation
    const adminEmail = this.configService.get<string>('GOOGLE_ADMIN_EMAIL');
    if (!adminEmail) {
      throw new Error('Missing GOOGLE_ADMIN_EMAIL in environment variables');
    }

    // Initialize the JWT client with the required audit scope
    this.auth = new google.auth.JWT({
      email: keyFile.client_email,
      key: keyFile.private_key,
      scopes: ['https://www.googleapis.com/auth/admin.reports.audit.readonly'],
      subject: adminEmail,
    });

    // Create the Admin SDK Reports API client
    this.reportsClient = google.admin({ version: 'reports_v1', auth: this.auth });
  }

  /**
   * Fetch Google Meet activities filtered by a specific conferenceId.
   * @param conferenceId The conferenceId to look up.
   * @returns The API response (activities).
   */
  async fetchSingleEventByConferenceId(conferenceId: string): Promise<any> {
    try {
      const response = await this.reportsClient.activities.list({
        userKey: 'all',
        applicationName: 'meet',
        filters: `conference_id==${conferenceId}`,
      });

      // Simply return the entire response’s data.
      return response.data;
    } catch (error) {
      this.logger.error(`Error fetching event with conferenceId="${conferenceId}"`, error);
      throw error;
    }
  }
}