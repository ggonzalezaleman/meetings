import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);
  private calendar;

  constructor() {
    // Read the service account key from environment variables
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
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
    // This is who we impersonate by default, but you could override dynamically if needed.
    const adminEmail = process.env.GOOGLE_ADMIN_EMAIL;
    if (!adminEmail) {
      throw new Error('Missing GOOGLE_ADMIN_EMAIL in environment variables');
    }

    // Initialize JWT for Calendar API with the calendar.readonly scope
    // By default, impersonates adminEmail as the subject
    const auth = new google.auth.JWT({
      email: keyFile.client_email,
      key: keyFile.private_key,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
      subject: adminEmail,
    });

    // Create a Calendar API client
    this.calendar = google.calendar({ version: 'v3', auth });
  }

  /**
   * Gets the event summary (meeting name) from the specified calendar ID,
   * handling recurring event suffixes if needed.
   * 
   * @param calendarId - e.g. the organizer's email or 'primary'
   * @param eventId - possibly with a _2025... suffix for recurring events
   * @returns The event summary or an empty string if not found
   */
  async getEventTitle(calendarId: string, eventId: string): Promise<string> {
    this.logger.log(`Fetching event title for eventId: ${eventId} on calendar: ${calendarId}`);
    // 1) Attempt the full ID
    try {
      const response = await this.calendar.events.get({ calendarId, eventId });
      const summary = response.data.summary || '';
      this.logger.log(`Fetched summary: "${summary}" for eventId: ${eventId}`);
      return summary;
    } catch (error: any) {
      // If 404, try removing the recurrence suffix
      if (error?.response?.status === 404) {
        const baseId = eventId.split('_')[0];
        if (baseId !== eventId) {
          this.logger.warn(`404 for eventId: ${eventId}; attempting base ID: ${baseId}`);
          try {
            const response2 = await this.calendar.events.get({
              calendarId,
              eventId: baseId,
            });
            const summary2 = response2.data.summary || '';
            this.logger.log(`Fetched summary (base ID): "${summary2}" for eventId: ${baseId}`);
            return summary2;
          } catch (error2: any) {
            this.logger.error(`Still not found for base ID: ${baseId}`, error2);
            return '';
          }
        }
      }
      this.logger.error(
        `Error fetching event ${eventId} from calendar ${calendarId}`,
        error
      );
      return '';
    }
  }
}
