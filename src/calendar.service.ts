import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);
  private calendar: any;

  constructor() {
    // 1) Parse service account key from environment
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

    // 2) Admin email for domain-wide delegation
    const adminEmail = process.env.GOOGLE_ADMIN_EMAIL;
    if (!adminEmail) {
      throw new Error('Missing GOOGLE_ADMIN_EMAIL in environment variables');
    }

    // 3) Auth setup (JWT)
    const auth = new google.auth.JWT({
      email: keyFile.client_email,
      key: keyFile.private_key,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
      subject: adminEmail, // Impersonate the admin or a domain user
    });

    // 4) Create a Google Calendar client
    this.calendar = google.calendar({ version: 'v3', auth });
  }

  /**
   *-------------------------------------------------------------------------
   * Method A) getEventTitle
   *-------------------------------------------------------------------------
   * Returns only the "summary" of an event (meeting name).
   * Used by controllers when we only need the event title.
   */
  async getEventTitle(calendarId: string, eventId: string): Promise<string> {
    // We can re-use the logic from getEventDetails
    const details = await this.getEventDetails(calendarId, eventId);
    return details.summary || '';
  }

  /**
   *-------------------------------------------------------------------------
   * Method B) getEventDetails
   *-------------------------------------------------------------------------
   * Returns the event summary + attendees. Automatically falls back to
   * the base ID if the recurring suffix (_2025...) fails with 404.
   */
  async getEventDetails(
    calendarId: string,
    eventId: string,
  ): Promise<{
    summary: string;
    attendees: { email: string; displayName?: string; responseStatus: string }[];
  }> {
    this.logger.log(`Fetching event details for eventId: ${eventId} on calendar: ${calendarId}`);

    try {
      // 1) Attempt to fetch the event (possibly recurring)
      const response = await this.calendar.events.get({ calendarId, eventId });
      const eventData = response.data;
      const summary = eventData.summary || '';

      // 2) Map attendees
      const attendees = (eventData.attendees || []).map((a: any) => ({
        email: a.email,
        displayName: a.displayName,
        responseStatus: a.responseStatus, // "accepted", "tentative", "needsAction", "declined", etc.
      }));

      this.logger.log(
        `Fetched summary="${summary}" with ${attendees.length} attendees for eventId="${eventId}".`,
      );
      return { summary, attendees };
    } catch (error: any) {
      // 3) If 404, try removing the recurrence suffix (the part after underscore)
      if (error?.response?.status === 404) {
        const baseId = eventId.split('_')[0];
        if (baseId !== eventId) {
          this.logger.warn(
            `404 for eventId="${eventId}"; attempting base ID="${baseId}"`,
          );
          try {
            const response2 = await this.calendar.events.get({
              calendarId,
              eventId: baseId,
            });
            const eventData2 = response2.data;
            const summary2 = eventData2.summary || '';
            const attendees2 = (eventData2.attendees || []).map((a: any) => ({
              email: a.email,
              displayName: a.displayName,
              responseStatus: a.responseStatus,
            }));

            this.logger.log(
              `Fetched summary="${summary2}" with ${attendees2.length} attendee(s) using baseId="${baseId}".`,
            );
            return { summary: summary2, attendees: attendees2 };
          } catch (error2: any) {
            this.logger.error(`Still not found for base ID="${baseId}"`, error2);
            return { summary: '', attendees: [] };
          }
        }
      }

      // 4) Any other error
      this.logger.error(
        `Error fetching event="${eventId}" from calendar="${calendarId}"`,
        error,
      );
      return { summary: '', attendees: [] };
    }
  }
}