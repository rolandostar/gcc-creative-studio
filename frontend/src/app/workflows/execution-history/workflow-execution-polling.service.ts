import { Injectable } from '@angular/core';
import { Observable, timer, of } from 'rxjs';
import { switchMap, map, catchError, shareReplay } from 'rxjs/operators';
import { WorkflowService } from '../workflow.service';

@Injectable({
  providedIn: 'root'
})
export class WorkflowExecutionPollingService {
  private readonly POLLING_INTERVAL = 3000;

  constructor(private workflowService: WorkflowService) { }

  /**
   * Polls for executions for a given workflowID every 3 seconds.
   * Returns the most recent 20 executions.
   * @param workflowId 
   * @returns Observable of execution list
   */
  pollExecutions(workflowId: string): Observable<any[]> {
    return timer(0, this.POLLING_INTERVAL).pipe(
      switchMap(() => this.workflowService.getExecutions(workflowId, 20, undefined, 'ALL').pipe(
        map(response => response.executions),
        catchError(err => {
          console.error('Error fetching executions in poll:', err);
          return of([]);
        })
      )),
      shareReplay(1)
    );
  }
}
