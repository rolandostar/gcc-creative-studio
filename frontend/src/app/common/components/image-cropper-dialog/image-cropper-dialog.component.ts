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

import { Component, Inject, OnInit, OnDestroy } from '@angular/core'; // Added OnInit, OnDestroy
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {
  ImageCroppedEvent,
  ImageTransform,
  CropperOptions,
} from 'ngx-image-cropper';
import { MatSnackBar } from '@angular/material/snack-bar';
import { handleErrorSnackbar } from '../../../utils/handleMessageSnackbar';
import {HttpClient} from '@angular/common/http';
import { Observable, finalize, Subject, takeUntil } from 'rxjs'; // Added Subject, takeUntil
import {
  SourceAssetService,
} from '../../services/source-asset.service';
import {
  AssetTypeEnum,
} from '../../../admin/source-assets-management/source-asset.model';
import {environment} from '../../../../environments/environment';
import { MediaItem, JobStatus } from '../../models/media-item.model'; // Added MediaItem and JobStatus

interface AspectRatio {
  label: string;
  value: number;
  stringValue: string;
}

// START: New Interface for Upscale Factor
interface UpscaleFactor {
  label: string;
  value: number; // 1 for original, 2 for 2x, etc.
  stringValue: string; // "1x", "2x", "3x", "4x"
}
// END: New Interface for Upscale Factor

@Component({
  selector: 'app-image-cropper-dialog',
  templateUrl: './image-cropper-dialog.component.html',
  styleUrls: ['./image-cropper-dialog.component.scss'],
})
export class ImageCropperDialogComponent implements OnInit, OnDestroy { // Added Lifecycle interfaces
  isUploading = false;
  isConverting = false; // New state for the conversion step
  imageFile: File | null = null; // Initialize as null
  enableUpscale = false; // Add property for template access

  croppedImageBlob: Blob | null = null;
  aspectRatios: AspectRatio[] = [];
  currentAspectRatio: number;
  containWithinAspectRatio = false;
  backgroundColor = 'white';

  // START: Job Status Tracking Properties
  private destroy$ = new Subject<void>();
  activeUpscaleJob$: Observable<MediaItem | null>;
  public readonly JobStatus = JobStatus;
  isStartingJob = false;
  // END: Job Status Tracking Properties

  // START: Upscale Factor Properties
  upscaleFactors: UpscaleFactor[] = [
    { label: 'x2', value: 1, stringValue: 'x2' },
    { label: 'x3', value: 2, stringValue: 'x3' },
    { label: 'x4', value: 3, stringValue: 'x4' },
  ];
  currentUpscaleFactor: number;
  // END: Upscale Factor Properties

  transform: ImageTransform = {
    translateUnit: 'px',
    scale: 1,
    rotate: 0,
    flipH: false,
    flipV: false,
  };
  canvasRotation = 0;
  options: Partial<CropperOptions>;

  constructor(
    public dialogRef: MatDialogRef<ImageCropperDialogComponent>,
    private http: HttpClient,
    private sourceAssetService: SourceAssetService,
    private _snackBar: MatSnackBar,
    @Inject(MAT_DIALOG_DATA)
    public data: {
      imageFile: File;
      assetType: AssetTypeEnum;
      aspectRatios?: AspectRatio[];
        enableUpscale?: boolean; // Added optional flag
    },
  ) {
    // Initialize the job stream from the service
    this.activeUpscaleJob$ = this.sourceAssetService.activeUpscaleJob$;

    // START: Initialize enableUpscale
    this.enableUpscale = this.data.enableUpscale || false;
    // END: Initialize enableUpscale

    this.aspectRatios = data.aspectRatios || [
      {label: '1:1 Square', value: 1 / 1, stringValue: '1:1'},
      {label: '16:9 Horizontal', value: 16 / 9, stringValue: '16:9'},
      {label: '9:16 Vertical', value: 9 / 16, stringValue: '9:16'},
      {label: '3:4 Portrait', value: 3 / 4, stringValue: '3:4'},
      {label: '4:3 Pin', value: 4 / 3, stringValue: '4:3'},
    ];
    this.currentAspectRatio = this.aspectRatios[0].value;

    // START: Initialize currentUpscaleFactor
    this.currentUpscaleFactor = this.upscaleFactors[0].value;
    // END: Initialize currentUpscaleFactor

    // Initialize the options object
    this.options = {
      aspectRatio: this.currentAspectRatio,
      maintainAspectRatio: true,
      containWithinAspectRatio: this.containWithinAspectRatio,
      backgroundColor: this.backgroundColor,
      autoCrop: true,
    };
    this.handleFile(this.data.imageFile); // Handle the file on init
  }

  // START: Lifecycle Hooks
  ngOnInit(): void {
    // Monitor the job status to handle auto-closing on success
    this.activeUpscaleJob$
      .pipe(takeUntil(this.destroy$))
      .subscribe(job => {
        if (job?.status === JobStatus.COMPLETED) {
          // Brief delay so the user sees the "Success" state in your new HTML
          setTimeout(() => {
            this.dialogRef.close(job);
          }, 1500);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  // END: Lifecycle Hooks

  // --- Start: New file handling logic ---
  handleFile(file: File): void {
    const supportedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/gif',
      'image/png',
      'image/webp',
    ];
    if (supportedTypes.includes(file.type)) {
      // If the format is supported, load it directly into the cropper
      this.imageFile = file;
    } else {
      // If the format is unsupported (like AVIF), convert it via the backend
      this.isConverting = true;
      this.convertImageOnBackend(file)
        .pipe(finalize(() => (this.isConverting = false)))
        .subscribe({
          next: pngBlob => {
            // Create a new File from the returned PNG blob and load it
            this.imageFile = new File([pngBlob], 'converted-image.png', {
              type: 'image/png',
            });
          },
          error: err => {
            console.error('Image conversion failed:', err);
            this.dialogRef.close(); // Close dialog on conversion failure
          },
        });
    }
  }

  private convertImageOnBackend(file: File): Observable<Blob> {
    const formData = new FormData();
    formData.append('file', file);
    // Assumes you create a new backend endpoint for this
    const convertUrl = `${environment.backendURL}/source_assets/convert-to-png`;
    return this.http.post(convertUrl, formData, {responseType: 'blob'});
  }

  // --- Start: Add Event Handlers ---
  onAspectRatioChange(newRatio: number): void {
    this.currentAspectRatio = newRatio;
    this.options = {...this.options, aspectRatio: newRatio};
  }

  onBackgroundColorChange(newColor: string): void {
    this.backgroundColor = newColor;
    this.options = {...this.options, backgroundColor: newColor};
  }

  // START: Upscale Factor Handler
  onUpscaleFactorChange(newFactor: number): void {
    this.currentUpscaleFactor = newFactor;
  }
  // END: Upscale Factor Handler

  // --- Start: Add New Control Methods ---
  rotateLeft() {
    this.canvasRotation--;
  }

  rotateRight() {
    this.canvasRotation++;
  }

  moveLeft() {
    this.transform = {
      ...this.transform,
      translateH: (this.transform.translateH || 0) - 5,
    };
  }

  moveRight() {
    this.transform = {
      ...this.transform,
      translateH: (this.transform.translateH || 0) + 5,
    };
  }

  moveDown() {
    this.transform = {
      ...this.transform,
      translateV: (this.transform.translateV || 0) + 5,
    };
  }

  moveUp() {
    this.transform = {
      ...this.transform,
      translateV: (this.transform.translateV || 0) - 5,
    };
  }

  flipHorizontal() {
    this.transform = {...this.transform, flipH: !this.transform.flipH};
  }

  flipVertical() {
    this.transform = {...this.transform, flipV: !this.transform.flipV};
  }

  zoomOut() {
    this.transform = {
      ...this.transform,
      scale: (this.transform.scale || 1) - 0.1,
    };
  }

  zoomIn() {
    this.transform = {
      ...this.transform,
      scale: (this.transform.scale || 1) + 0.1,
    };
  }
  // --- End: Add New Control Methods ---

  imageCropped(event: ImageCroppedEvent) {
    if (event.blob) {
      this.croppedImageBlob = event.blob;
    }
    // Note: The selected upscale factor is applied when calling uploadAsset
  }

  uploadCroppedImage() {
    if (this.croppedImageBlob) {
      const croppedFile = new File(
        [this.croppedImageBlob],
        this.imageFile?.name || 'untitled',
        {
          type: 'image/png',
        },
      );

      // 3. Find the string value of the current aspect ratio
      const selectedRatio = this.aspectRatios.find(
        r => r.value === this.currentAspectRatio,
      );
      const aspectRatioString = selectedRatio
        ? selectedRatio.stringValue
        : '1:1';

      const selectedFactor = this.upscaleFactors.find(
        f => f.value === this.currentUpscaleFactor,
      );
      // Only set the upscale string if the feature is explicitly enabled
      const upscaleFactorString = (this.enableUpscale && selectedFactor)
        ? selectedFactor.stringValue
        : ''; // Default to empty (No Upscale)

      this.isUploading = true;
      this.isStartingJob = true; // Set connecting state

      if (upscaleFactorString) {
        // Case 1: Upscale Requested
        this.sourceAssetService.uploadAndUpscaleImageAsset(croppedFile, {
          aspectRatio: aspectRatioString,
          upscaleFactor: upscaleFactorString,
        })
          .pipe(finalize(() => {
            this.isUploading = false;
            this.isStartingJob = false;
          }))
          .subscribe({
            next: (job) => {
              this.dialogRef.close({ started: true, job: job });
            },
            error: (err) => {
              console.error("Upscale job failed to start:", err);
              const context = err.status === 400 ? 'Image already in high resolution' : 'Upscale Failed';
              handleErrorSnackbar(this._snackBar, err, context);
            }
          });
      } else {
        // Case 2: No Upscale (Just Upload)
        this.sourceAssetService.uploadAsset(croppedFile, {
          aspectRatio: aspectRatioString,
        })
          .pipe(finalize(() => {
            this.isUploading = false;
            this.isStartingJob = false;
          }))
          .subscribe({
            next: (asset) => {
              // Return the asset so calling components can use it
              this.dialogRef.close({ started: false, asset: asset });
              this.sourceAssetService.refreshAssets(); // Ensure assets list is updated
            },
            error: (err) => {
              console.error("Upload failed:", err);
              handleErrorSnackbar(this._snackBar, err, 'Upload Failed');
            },
          });
      }
    }
  }
}