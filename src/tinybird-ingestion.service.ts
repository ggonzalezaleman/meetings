import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class TinybirdIngestionService {
  private readonly logger = new Logger(TinybirdIngestionService.name);
  private readonly tinybirdToken = process.env.TINYBIRD_TOKEN;
  private readonly tinybirdDataSource = process.env.TINYBIRD_DATA_SOURCE;
  private readonly tinybirdUrl = process.env.TINYBIRD_URL || 'https://api.tinybird.co/v0/events';

  /**
   * Pushes an array of data objects to Tinybird using NDJSON ingestion.
   * @param data An array of JSON objects to be ingested.
   */
  async pushData(data: any[]): Promise<void> {
    if (!this.tinybirdToken) {
      throw new Error('TINYBIRD_TOKEN is not set in environment variables');
    }
    if (!this.tinybirdDataSource) {
      throw new Error('TINYBIRD_DATA_SOURCE is not set in environment variables');
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
      this.logger.log(`Data ingested successfully into Tinybird: ${JSON.stringify(response.data)}`);
    } catch (error) {
      this.logger.error('Error ingesting data into Tinybird', error);
      throw error;
    }
  }
}
