import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Clip {
  assetId: string;
  url: string;
  startTime: number;
  duration: number;
  offset: number;
  trackIndex: number;
  type: 'video' | 'audio';
}

export interface TimelineRequest {
  clips: Clip[];
  output_format?: string;
  width?: number;
  height?: number;
}

@Injectable({
  providedIn: 'root'
})
export class WorkbenchService {
  private apiUrl = `${environment.backendURL}/workbench`;

  constructor(private http: HttpClient) { }

  renderVideo(request: TimelineRequest): Observable<Blob> {
    return this.http.post(`${this.apiUrl}/render`, request, {
      responseType: 'blob'
    });
  }
}
