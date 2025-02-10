import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class PeopleForceService {
  private readonly logger = new Logger(PeopleForceService.name);
  // Endpoint URL for PeopleForce employees
  private readonly apiUrl = 'https://app.peopleforce.io/api/public/v2/employees';
  // Use an environment variable for the API key if desired.
  private readonly apiKey = process.env.PEOPLEFORCE_API_KEY || '';

  // Fetch all employee data with pagination
  async fetchEmployees(): Promise<any[]> {
    let allEmployees: any[] = [];
    let page = 1;
    let totalPages = 1;

    try {
      do {
        const response = await axios.get(this.apiUrl, {
          headers: {
            'X-API-KEY': this.apiKey,
          },
          params: { page },
        });
        const data = response.data;
        if (data && data.data) {
          allEmployees = allEmployees.concat(data.data);
        }
        if (data?.metadata?.pagination) {
          totalPages = data.metadata.pagination.pages;
        }
        page++;
      } while (page <= totalPages);
    } catch (error: any) {
      this.logger.error('Error fetching employees from PeopleForce', error);
      throw error;
    }
    return allEmployees;
  }

  // Transform an individual employee record into the format needed for Tinybird.
  transformEmployee(employee: any): any {
    return {
      employeeId: employee.id,
      employeeNumber: employee.employee_number,
      fullName: employee.full_name,
      email: employee.email,
      position: employee.position ? employee.position.name : null,
      department: employee.department ? employee.department.name : null,
      division: employee.division ? employee.division.name : null, // Added division name
      // Reporting information:
      reportingToId: employee.reporting_to ? employee.reporting_to.id : null,
      reportingToEmail: employee.reporting_to ? employee.reporting_to.email : null,
      reportingToFullName: employee.reporting_to 
        ? `${employee.reporting_to.first_name} ${employee.reporting_to.last_name}` 
        : null, // Added reportingTo full name
    };
  }

  // Fetch and transform all employees
  async getTransformedEmployees(): Promise<any[]> {
    const employees = await this.fetchEmployees();
    return employees.map(emp => this.transformEmployee(emp));
  }
}
