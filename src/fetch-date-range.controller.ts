import { Controller, Get, Query, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { GoogleMeetReportsService } from './google-meet-reports.service';
import { TinybirdIngestionService } from './tinybird-ingestion.service';
import { CalendarService } from './calendar.service';
import { processActivities, SimplifiedMeetingActivity } from './meet-activity-transformer';

@Controller()
export class FetchDateRangeController {
  private readonly logger = new Logger(FetchDateRangeController.name);

  // A regex to detect key words in either participantEmail or participantDisplayName
  // (case-insensitive).
  private readonly notetakerRegex = /note|read|meeting|fireflies|phantom|bot|otter|vomo/i;

  constructor(
    private readonly googleMeetReportsService: GoogleMeetReportsService,
    private readonly tinybirdIngestionService: TinybirdIngestionService,
    private readonly calendarService: CalendarService,
  ) {}

  /**
   * GET /fetch-date-range?start=YYYY-MM-DD&end=YYYY-MM-DD
   *
   * Example: /fetch-date-range?start=2024-11-01&end=2024-11-30
   *
   * This endpoint loops from the start date to the end date (inclusive),
   * fetching Google Meet data day by day, then pushes it to Tinybird.
   *
   * We preserve participantDisplayName from the Admin SDK logs,
   * but exclude any row if participantEmail or participantDisplayName
   * contain certain bot/notetaker keywords (case-insensitive).
   *
   * We also exclude these bot attendees from the calendar's
   * "invited" list. Thus, they do not factor into participantCount
   * or invitedCount.
   *
   * Columns:
   *   - participantCount: total unique non-bot participants in the meeting
   *   - invitedCount: null if no calendar event matched, else the count of non-bot attendees
   *   - attendeePercentage: participantCount / invitedCount * 100,
   *     undefined if invitedCount is null
   */
  @Get('/fetch-date-range')
  async fetchDateRange(
    @Query('start') startStr: string,
    @Query('end') endStr: string,
  ) {
    if (!startStr || !endStr) {
      throw new HttpException(
        'Query params "start" and "end" (YYYY-MM-DD) are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Parse the start & end dates
    let startDate: Date;
    let endDate: Date;
    try {
      startDate = new Date(`${startStr}T00:00:00Z`);
      endDate = new Date(`${endStr}T00:00:00Z`);
    } catch (error) {
      throw new HttpException(
        'Invalid date format. Use YYYY-MM-DD in "start" and "end".',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new HttpException(
        'Invalid date string. Use YYYY-MM-DD format.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (startDate > endDate) {
      throw new HttpException(
        '"start" date cannot be after "end" date.',
        HttpStatus.BAD_REQUEST,
      );
    }

    let totalActivities = 0;
    const dateCursor = new Date(startDate);

    // Helper function to detect whether the record belongs to a "notetaker/bot".
    const isNotetaker = (displayName: string | undefined, email: string | undefined): boolean => {
      return (
        this.notetakerRegex.test(displayName || '') ||
        this.notetakerRegex.test(email || '')
      );
    };

    while (dateCursor <= endDate) {
      const dateParam = dateCursor.toISOString().split('T')[0]; // "YYYY-MM-DD"
      this.logger.log(`Fetching data for ${dateParam}...`);

      try {
        // 1) Fetch raw data from the Admin SDK
        const rawData = await this.googleMeetReportsService.fetchMeetActivities(dateParam);

        // 2) Transform raw data
        let simplified: SimplifiedMeetingActivity[] = processActivities(rawData.items || []);

        // 2B) Filter out notetakers/bots from the participant side
        simplified = simplified.filter(
          (act) => !isNotetaker(act.participantDisplayName, act.participantEmail),
        );

        // 3) Enrich each activity with meeting info + minimal attendee data (excluding bot attendees)
        for (const activity of simplified) {
          if (activity.calendarEventId && activity.organizerEmail) {
            const eventDetails = await this.calendarService.getEventDetails(
              activity.organizerEmail,
              activity.calendarEventId,
            );

            (activity as any).meetingName = eventDetails.summary;

            // Only store non-bot attendee email + responseStatus (no displayName).
            // This ensures any bots in the calendar invite are also excluded from invitedCount.
            (activity as any).attendees = eventDetails.attendees
              .filter((att) => {
                // Return false if this is a notetaker
                return !isNotetaker(undefined, att.email);
              })
              .map((att) => ({
                email: att.email,
                responseStatus: att.responseStatus,
              }));
          } else {
            (activity as any).meetingName = '';
            (activity as any).attendees = [];
          }
        }

        // 4) Compute participantCount, invitedCount, attendeePercentage
        const groupedByConf = new Map<string, SimplifiedMeetingActivity[]>();
        for (const item of simplified) {
          if (!groupedByConf.has(item.conferenceId)) {
            groupedByConf.set(item.conferenceId, []);
          }
          groupedByConf.get(item.conferenceId)!.push(item);
        }

        for (const [, group] of groupedByConf.entries()) {
          // 4A) Distinct participant emails (non-bot) for that meeting
          const distinctParticipantEmails = new Set(
            group.map((g) => g.participantEmail.toLowerCase()),
          );
          const participantCount = distinctParticipantEmails.size;

          // 4B) If no matching calendar event or no remaining attendees (all bots?), invitedCount is null
          const groupAttendees = (group[0] as any)?.attendees ?? [];
          const invitedCount = groupAttendees.length > 0 ? groupAttendees.length : null;

          let attendeePercentage: number | undefined;
          if (invitedCount !== null) {
            attendeePercentage = Math.round((participantCount / invitedCount) * 100);
          }

          // Assign these columns to each item in the group
          for (const row of group) {
            (row as any).participantCount = participantCount;
            (row as any).invitedCount = invitedCount;
            (row as any).attendeePercentage = attendeePercentage;
          }
        }

        // 5) Push data to Tinybird, if any left
        if (simplified.length > 0) {
          const dataForTinybird = simplified.map((activity) => ({
            ...activity,
            isExternal: activity.isExternal ? 1 : 0,
            attendees: (activity as any).attendees || [],
            participantCount: (activity as any).participantCount,
            invitedCount: (activity as any).invitedCount,
            attendeePercentage: (activity as any).attendeePercentage,
          }));

          await this.tinybirdIngestionService.pushData(dataForTinybird);
          this.logger.log(
            `Pushed ${simplified.length} records (excluding bot participants) for ${dateParam} to Tinybird.`,
          );
          totalActivities += simplified.length;
        } else {
          this.logger.log(`No relevant (non-bot) data for ${dateParam}.`);
        }
      } catch (error) {
        this.logger.error(`Error processing date ${dateParam}:`, error);
        // Decide whether to throw or continue
      }

      // Move cursor ahead by 1 day
      dateCursor.setDate(dateCursor.getDate() + 1);
    }

    return {
      message: `Fetched & pushed data from ${startStr} to ${endStr}, excluding notetakers, with new columns (participantCount, invitedCount=null for no match, attendeePercentage).`,
      totalActivities,
    };
  }
}