/**
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


import { Component, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Subject, combineLatest, Observable } from 'rxjs';
import { takeUntil, map, distinctUntilChanged } from 'rxjs/operators';
// Redundant snackbar imports removed
import { ImageSelectorComponent } from '../common/components/image-selector/image-selector.component';
import { SourceAssetService } from '../common/services/source-asset.service';
import { GalleryService } from '../gallery/gallery.service';
import { AssetTypeEnum } from '../admin/source-assets-management/source-asset.model';
import { MediaItem, JobStatus } from '../common/models/media-item.model';

interface UploadedAsset { name: string; url: string; }
interface AssetPair { original: UploadedAsset | null; upscaled: UploadedAsset | null; }

@Component({
  selector: 'app-upscale',
  templateUrl: './upscale.component.html',
  styleUrls: ['./upscale.component.scss']
})
export class UpscaleComponent implements OnInit, OnDestroy {
  assetPair: AssetPair = { original: null, upscaled: null };
  isLoadingUpscale = false;
  sliderValue: number = 50;
  showErrorOverlay = true; // Controls visibility of the error overlay
  readonly assetType = AssetTypeEnum.GENERIC_IMAGE;
  public readonly JobStatus = JobStatus;

  private destroy$ = new Subject<void>();

  // 1. Unified job stream for the full-screen overlay
  activeUpscaleJob$: Observable<MediaItem | null> | null = null;

  constructor(
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private sourceAssetService: SourceAssetService,
    private galleryService: GalleryService
  ) {
    // Initialize the combined job stream
    // this.activeUpscaleJob$ = combineLatest([
    //   this.sourceAssetService.activeUpscaleJob$,
    //   this.galleryService.activeUpscaleJob$
    // ]).pipe(
    //   map(([sourceJob, galleryJob]) => sourceJob || galleryJob)
    // );
  }

  ngOnInit(): void {
    /**
     * 2. Subscribe to job changes to update the local component state
     * This handles the image comparison view logic.
     */
    // this.activeUpscaleJob$
    //   .pipe(
    //     takeUntil(this.destroy$),
    //     distinctUntilChanged((prev, curr) => prev?.id === curr?.id && prev?.status === curr?.status)
    //   )
    //   .subscribe((activeJob) => {
    //     if (activeJob) {
    //       // Sync local loading state
    //       this.isLoadingUpscale = activeJob.status === JobStatus.PROCESSING;

    //       if (activeJob.status === JobStatus.COMPLETED) {
    //         // Reset error overlay for future jobs
    //         this.showErrorOverlay = true;
    //         // Snackbar logic moved to AppComponent

    //         const originalUrl = (activeJob.originalPresignedUrls && activeJob.originalPresignedUrls.length > 0)
    //           ? activeJob.originalPresignedUrls[0]
    //           : (activeJob as any).url;

    //         const upscaledUrl = (activeJob.presignedUrls && activeJob.presignedUrls.length > 0)
    //           ? activeJob.presignedUrls[0]
    //           : (activeJob as any).url;

    //         this.assetPair.original = { name: 'Original Image', url: originalUrl };
    //         this.assetPair.upscaled = { name: 'Upscaled Image', url: upscaledUrl };
    //       } else if (activeJob.status === JobStatus.FAILED) {
    //         this.isLoadingUpscale = false;
    //         // Snackbar logic moved to AppComponent
    //         this.showErrorOverlay = false;
    //       }

    //       this.cdr.detectChanges();
    //     }
    //   });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  closeErrorOverlay(): void {
    this.showErrorOverlay = false;
    this.isLoadingUpscale = false;
  }

  openUploaderDialog(event?: MouseEvent): void {
    if (event) event.stopPropagation();

    const dialogRef = this.dialog.open(ImageSelectorComponent, {
      width: '90vw',
      height: '80vh',
      maxWidth: '90vw',
      data: {
        mimeType: 'image/*',
        assetType: this.assetType,
        enableUpscale: true // Enable upscale UI for this specific flow
      }
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        console.log('Upscale initiated in background...');
      } else if (!this.assetPair.upscaled) {
        this.isLoadingUpscale = false;
      }
    });
  }

  async downloadUpscaled(): Promise<void> {
    if (!this.assetPair.upscaled) return;
    const imageUrl = this.assetPair.upscaled.url;

    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `upscaled-image-${Date.now()}.png`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed. Falling back to default link behavior.', error);
      window.open(imageUrl, '_blank');
    }
  }

  clearImage(event: MouseEvent): void {
    event.stopPropagation();
    this.assetPair = { original: null, upscaled: null };
    this.isLoadingUpscale = false;
    // Notify services to clear status to allow new uploads
    (this.sourceAssetService as any).activeUpscaleJob.next(null);
    (this.galleryService as any).activeUpscaleJob.next(null);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.openUploaderDialog();
  }
}