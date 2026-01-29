/**
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  BehaviorSubject,
  combineLatest,
  Observable,
  of,
  Subscription,
  EMPTY,
  timer,
} from 'rxjs';
import {
  tap,
  catchError,
  shareReplay,
  switchMap,
  debounceTime,
} from 'rxjs/operators';
import {
  MediaItem,
  PaginatedGalleryResponse,
  JobStatus,
} from '../common/models/media-item.model';
import { environment } from '../../environments/environment';
import { GallerySearchDto } from '../common/models/search.model';
import { WorkspaceStateService } from '../services/workspace/workspace-state.service';

export interface MediaItemOptionsDto {
  id?: string;
  gcsUri?: string;
  mimeType?: string;
  aspectRatio?: string;
  upscaleFactor?: string;
}

@Injectable({
  providedIn: 'root',
})
export class GalleryService implements OnDestroy {
  /* ------------------ Gallery state ------------------ */

  private imagesCache$ = new BehaviorSubject<MediaItem[]>([]);
  public isLoading$ = new BehaviorSubject<boolean>(false);
  private allImagesLoaded$ = new BehaviorSubject<boolean>(false);

  private allFetchedImages: MediaItem[] = [];
  private filters$ = new BehaviorSubject<GallerySearchDto>({ limit: 20 });
  private dataLoadingSubscription: Subscription;

  /* ------------------ Upscale polling (SearchService style) ------------------ */

  private activeUpscaleJob = new BehaviorSubject<MediaItem | null>(null);
  public activeUpscaleJob$ = this.activeUpscaleJob.asObservable();
  private upscalePollingSubscription: Subscription | null = null;

  constructor(
    private http: HttpClient,
    private workspaceStateService: WorkspaceStateService,
  ) {
    /* ------------------ Gallery auto reload ------------------ */

    this.dataLoadingSubscription = combineLatest([
      this.workspaceStateService.activeWorkspaceId$,
      this.filters$,
    ])
      .pipe(
        debounceTime(50),
        switchMap(([workspaceId, filters]) => {
          this.isLoading$.next(true);
          this.resetCache();

          const body: GallerySearchDto = {
            ...filters,
            workspaceId: workspaceId ?? undefined,
            offset: 0,
          };

          return this.fetchImages(body).pipe(
            catchError(err => {
              console.error('Failed to fetch gallery images', err);
              this.isLoading$.next(false);
              this.allImagesLoaded$.next(true);
              return of(null);
            }),
          );
        }),
      )
      .subscribe(response => {
        if (response) {
          this.processFetchResponse(response);
        }
      });
  }

  // UPSCALE (WITH POLLING)

  upscaleExistingMediaItem(
    mediaItem: MediaItem,
    options: MediaItemOptionsDto = {},
  ): Observable<MediaItem> {
    const assetData = (mediaItem as any).data || mediaItem;
    const formData = new FormData();

    formData.append('mediaItemId', assetData.id);
    formData.append('gcsUri', assetData.gcsUris?.[0] ?? '');
    formData.append('mimeType', assetData.mimeType);
    formData.append('aspectRatio', assetData.aspectRatio);

    if (options.upscaleFactor) {
      formData.append('upscaleFactor', options.upscaleFactor);
    }

    const workspaceId = this.workspaceStateService.getActiveWorkspaceId();
    if (workspaceId) {
      formData.append('workspaceId', workspaceId.toString());
    }

    return this.http
      .post<MediaItem>(
        `${environment.backendURL}/images/upload_upscale`,
        formData,
      )
      .pipe(
        tap(initialItem => {
          this.allFetchedImages.unshift(initialItem);
          this.imagesCache$.next(this.allFetchedImages);

          this.activeUpscaleJob.next(initialItem);
          this.startUpscalePolling(String(initialItem.id));
        }),
      );
  }

  private startUpscalePolling(mediaId: string): void {
    this.stopUpscalePolling();

    this.upscalePollingSubscription = timer(2000, 5000) // Start after 2s, then every 5s
      .pipe(
        switchMap(() => this.getUpscaleMediaItem(mediaId)),
        tap(latestItem => {
          this.activeUpscaleJob.next(latestItem);
          this.updateItemInCache(latestItem);

          if (
            latestItem.status === JobStatus.COMPLETED ||
            latestItem.status === JobStatus.FAILED
          ) {
            this.stopUpscalePolling();
          }
        }),
        catchError(err => {
          console.error('Upscale polling failed', err);
          this.stopUpscalePolling();
          return EMPTY;
        }),
      )
      .subscribe();
  }

  private stopUpscalePolling(): void {
    this.upscalePollingSubscription?.unsubscribe();
    this.upscalePollingSubscription = null;
  }

  getUpscaleMediaItem(mediaId: string): Observable<MediaItem> {
    const url = `${environment.backendURL}/gallery/item/${mediaId}`;
    return this.http.get<MediaItem>(url);
  }

  // GALLERY API

  get images$(): Observable<MediaItem[]> {
    return this.imagesCache$.asObservable();
  }

  get allImagesLoaded(): Observable<boolean> {
    return this.allImagesLoaded$.asObservable();
  }

  setFilters(filters: GallerySearchDto) {
    this.filters$.next(filters);
  }

  loadGallery(reset = false): void {
    if (this.isLoading$.value || this.allImagesLoaded$.value) {
      return;
    }

    if (reset) {
      this.resetCache();
    }

    const currentOffset = this.allFetchedImages.length;
    const body: GallerySearchDto = {
      ...this.filters$.value,
      workspaceId:
        this.workspaceStateService.getActiveWorkspaceId() ?? undefined,
      offset: currentOffset,
    };

    this.fetchImages(body)
      .pipe(
        catchError(err => {
          console.error('Failed to fetch gallery images', err);
          this.isLoading$.next(false);
          this.allImagesLoaded$.next(true);
          return of(null);
        }),
      )
      .subscribe(response => {
        if (response) {
          this.processFetchResponse(response, true);
        }
      });
  }

  private fetchImages(
    body: GallerySearchDto,
  ): Observable<PaginatedGalleryResponse> {
    this.isLoading$.next(true);
    return this.http
      .post<PaginatedGalleryResponse>(
        `${environment.backendURL}/gallery/search`,
        body,
      )
      .pipe(shareReplay(1));
  }

  private resetCache() {
    this.allFetchedImages = [];
    this.allImagesLoaded$.next(false);
    this.imagesCache$.next([]);
  }

  private processFetchResponse(
    response: PaginatedGalleryResponse,
    append = false,
  ) {
    this.allFetchedImages = append
      ? [...this.allFetchedImages, ...response.data]
      : response.data;

    this.imagesCache$.next(this.allFetchedImages);

    // If we have fetched all items (total count reached)
    if (this.allFetchedImages.length >= response.count) {
      this.allImagesLoaded$.next(true);
    }

    this.isLoading$.next(false);
  }

  getMedia(id: string): Observable<MediaItem> {
    return this.http.get<MediaItem>(
      `${environment.backendURL}/gallery/item/${id}`,
    );
  }

  createTemplateFromMediaItem(mediaItemId: string): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(
      `${environment.backendURL}/media-templates/from-media-item/${mediaItemId}`,
      {},
    );
  }


  public addImageToCache(item: MediaItem) {
    this.imagesCache$.next([item, ...this.imagesCache$.getValue()]);
  }

  private updateItemInCache(updated: MediaItem) {
    this.allFetchedImages = this.allFetchedImages.map(item =>
      item.id === updated.id ? updated : item
    );
    this.imagesCache$.next(this.allFetchedImages);
  }

  ngOnDestroy() {
    this.dataLoadingSubscription.unsubscribe();
    this.stopUpscalePolling();
  }
}
