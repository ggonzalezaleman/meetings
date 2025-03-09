import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class TinybirdEmployeeIngestionService {
  private readonly logger = new Logger(TinybirdEmployeeIngestionService.name);
  private readonly tinybirdToken = process.env.TINYBIRD_TOKEN;
  // Use a separate environment variable for the employee data source name.
  private readonly tinybirdDataSource = process.env.TINYBIRD_EMPLOYEE_DATA_SOURCE;
  private readonly tinybirdUrl = process.env.TINYBIRD_URL || 'https://api.tinybird.co/v0/events';

  async deleteAllData(): Promise<void> {
    const datasourceName = 'peopleforce_employees'; 
    const url = `https://api.us-east.aws.tinybird.co/v0/datasources/${datasourceName}/truncate`;

    try {
      await axios.post(url, null, {
        headers: {
          Authorization: `Bearer ${this.tinybirdToken}`,
        },
      });
      this.logger.log(`Truncated datasource "${datasourceName}" successfully.`);
    } catch (error: any) {
      this.logger.error(`Failed to truncate datasource "${datasourceName}".`, error);
      throw error;
    }
  }


  /**
   * Pushes an array of data objects to Tinybird using NDJSON ingestion.
   * @param data An array of JSON objects to be ingested.
   */
  async pushData(data: any[]): Promise<void> {
    if (!this.tinybirdToken) {
      throw new Error('TINYBIRD_TOKEN is not set in environment variables');
    }
    if (!this.tinybirdDataSource) {
      throw new Error('TINYBIRD_EMPLOYEE_DATA_SOURCE is not set in environment variables');
    }

    // Convert the data array into NDJSON format (each JSON object on a new line)
    const ndjson = data.map(item => JSON.stringify(item)).join('\n');

    try {
      const response = await axios.post(
        `${this.tinybirdUrl}?name=${this.tinybirdDataSource}`,
        ndjson,
        {
          headers: {
            'Authorization': `Bearer ${this.tinybirdToken}`,
            'Content-Type': 'application/x-ndjson'
          }
        }
      );
      this.logger.log(`Employee data ingested successfully into Tinybird: ${JSON.stringify(response.data)}`);
    } catch (error: any) {
      this.logger.error('Error ingesting employee data into Tinybird', error);
      throw error;
    }
  }
}
