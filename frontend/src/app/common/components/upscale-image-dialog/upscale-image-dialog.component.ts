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


import { Component, Inject, OnDestroy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, Observable } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { handleErrorSnackbar } from '../../../utils/handleMessageSnackbar';

import { SourceAssetService } from '../../services/source-asset.service';
import { GalleryService } from '../../../gallery/gallery.service';
import { MediaItem } from '../../models/media-item.model';

export interface UpscaleImageDialogData {
  asset?: any;
  selection?: MediaItem;
}

@Component({
  selector: 'app-upscale-image-dialog',
  templateUrl: './upscale-image-dialog.component.html',
  styleUrls: ['./upscale-image-dialog.component.scss'],
})
export class UpscaleImageDialogComponent implements OnDestroy {
  isStartingJob = false;
  private destroy$ = new Subject<void>();

  upscaleFactors = [
    { label: 'x2', value: 2, stringValue: 'x2' },
    { label: 'x3', value: 3, stringValue: 'x3' },
    { label: 'x4', value: 4, stringValue: 'x4' },
  ];
  currentUpscaleFactor: string = 'x2';

  constructor(
    public dialogRef: MatDialogRef<UpscaleImageDialogComponent>,
    private sourceAssetService: SourceAssetService,
    private galleryService: GalleryService,
    private _snackBar: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: UpscaleImageDialogData,
  ) { }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Fires the request and closes immediately.
   * The Parent component (UpscaleComponent) will listen to the 
   * Service's Job stream to handle the background UI.
   */
  confirmUpscale(): void {
    const options = { upscaleFactor: this.currentUpscaleFactor };
    this.isStartingJob = true;

    let request$: Observable<MediaItem>;

    // Identify which service should handle the upscale
    if (this.data.asset) {
      // Clear existing jobs to avoid UI confusion in the singleton services
      (this.galleryService as any).activeUpscaleJob.next(null);
      request$ = this.sourceAssetService.upscaleExistingAsset(this.data.asset, options);
    } else if (this.data.selection) {
      (this.sourceAssetService as any).activeUpscaleJob.next(null);
      request$ = this.galleryService.upscaleExistingMediaItem(this.data.selection, options as any);
    } else {
      this.isStartingJob = false;
      return;
    }

    request$.subscribe({
      next: (job) => {
        this.isStartingJob = false;
        // 🚀 FIRE AND FORGET: 
        // We close the dialog and pass the job info back.
        // The user can now use the parent component while the job runs.
        this.dialogRef.close({ started: true, job: job });
      },
      error: (err) => {
        this.isStartingJob = false;
        console.error("Upscale failed to start:", err);
        const context = err.status === 400 ? 'Image already in high resolution' : 'Upscale Failed';
        handleErrorSnackbar(this._snackBar, err, context);
        // Optionally pass the error back to show a toast in the parent
        this.dialogRef.close({ started: false, error: err });
      }
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}