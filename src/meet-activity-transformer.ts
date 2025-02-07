/**
 * This file transforms raw Google Meet activity data (from the Admin SDK audit logs)
 * into a simplified structure containing only the relevant fields.
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
   * Parses a single raw activity object and returns a simplified meeting activity.
   * If the required fields are missing, returns null.
   *
   * @param rawActivity - The raw activity object from the Google Admin SDK.
   * @returns A SimplifiedMeetingActivity object or null.
   */
  export function parseActivity(rawActivity: any): SimplifiedMeetingActivity | null {
    // Ensure the activity contains an events array with at least one event.
    if (!rawActivity.events || !Array.isArray(rawActivity.events) || rawActivity.events.length === 0) {
      return null;
    }
  
    // We'll work with the first event (most audit log entries contain one event per activity).
    const event = rawActivity.events[0];
  
    // Reduce the parameters array into a simple key/value object.
    const params = event.parameters.reduce((acc: Record<string, any>, param: any) => {
      // If an intValue exists, use that; otherwise, use the value property.
      acc[param.name] = param.intValue !== undefined ? param.intValue : param.value;
      return acc;
    }, {} as Record<string, any>);
  
    // Check for the required fields.
    if (!params.meeting_code || !params.conference_id || !params.organizer_email) {
      return null;
    }
  
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
      isExternal: params.is_external === true ||
                  params.is_external === 'true' ||
                  params.is_external === 1,
      location: {
        // Set defaults to an empty string if missing
        country: params.location_country || "",
        region: params.location_region || "",
      },
    };
  }
  
  /**
   * Processes an array of raw activity objects into an array of simplified meeting activities.
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
  