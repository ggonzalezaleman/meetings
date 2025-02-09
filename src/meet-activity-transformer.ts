/**
 * This file transforms raw Google Meet activity data (from the Admin SDK audit logs)
 * into a single, simplified structure. It assumes each "activity" in the logs contains
 * just one participant. If there's a second participant, it won't create a second record
 * (which is what you want to avoid duplication).
 */

export interface SimplifiedMeetingActivity {
    meetingCode: string;
    conferenceId: string;
    calendarEventId: string;
    organizerEmail: string;
    participantEmail: string;
    participantDisplayName: string;
    startTimestamp: string; // ISO date string
    durationSeconds: number;
    isExternal: boolean;
    location: {
      country: string;
      region: string;
    };
  }
  
  /**
   * Parses a single raw activity object and returns a single SimplifiedMeetingActivity.
   * If the required fields (meeting_code, conference_id, organizer_email) are missing,
   * it returns null.
   *
   * @param rawActivity - The raw activity object from the Google Admin SDK.
   * @returns A SimplifiedMeetingActivity object or null.
   */
  export function parseActivity(rawActivity: any): SimplifiedMeetingActivity | null {
    // 1. Ensure the activity has at least one event.
    if (!rawActivity.events || !Array.isArray(rawActivity.events) || rawActivity.events.length === 0) {
      return null;
    }
  
    // 2. We'll just work with the first event.
    const event = rawActivity.events[0];
  
    // 3. Reduce the parameters into a simple key/value object,
    //    properly handling boolValue, intValue, or value.
    const params = event.parameters.reduce((acc: Record<string, any>, param: any) => {
      let val: any;
      if (param.boolValue !== undefined) {
        val = param.boolValue;                // e.g. { name: "is_external", boolValue: true }
      } else if (param.intValue !== undefined) {
        val = param.intValue;                 // e.g. { name: "duration_seconds", intValue: 300 }
      } else {
        val = param.value;                    // e.g. { name: "meeting_code", value: "ABC123" }
      }
      acc[param.name] = val;
      return acc;
    }, {} as Record<string, any>);
  
    // 4. If we don't have the required fields, skip
    if (!params.meeting_code || !params.conference_id || !params.organizer_email) {
      return null;
    }
  
    // 5. Build the final SimplifiedMeetingActivity object
    return {
      meetingCode: params.meeting_code,
      conferenceId: params.conference_id,
      calendarEventId: params.calendar_event_id || '',
      organizerEmail: params.organizer_email,
      participantEmail: params.identifier || '',
      participantDisplayName: params.display_name || '',
      startTimestamp: params.start_timestamp_seconds
        ? new Date(Number(params.start_timestamp_seconds) * 1000).toISOString()
        : rawActivity.id?.time,
      durationSeconds: Number(params.duration_seconds) || 0,
      // If param.is_external is a real boolean (true/false), or "true"/"false", or 1/0,
      // the following logic catches all truthy combos:
      isExternal:
        params.is_external === true ||
        params.is_external === 'true' ||
        params.is_external === 1,
      location: {
        country: params.location_country || "",
        region: params.location_region || "",
      },
    };
  }
  
  /**
   * Processes an array of raw activity objects into an array of single-participant
   * SimplifiedMeetingActivity objects.
   *
   * @param rawActivities - The array of raw activity objects from the API.
   * @returns An array of SimplifiedMeetingActivity objects.
   */
  export function processActivities(rawActivities: any[]): SimplifiedMeetingActivity[] {
    const simplifiedActivities: SimplifiedMeetingActivity[] = [];
    for (const activity of rawActivities) {
      const parsed = parseActivity(activity);
      if (parsed) {
        simplifiedActivities.push(parsed);
      }
    }
    return simplifiedActivities;
  }
  