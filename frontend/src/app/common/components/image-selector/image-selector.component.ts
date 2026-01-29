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


import { Component, Inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogRef,
} from '@angular/material/dialog';
import { MediaItem } from '../../models/media-item.model';
import {
  SourceAssetResponseDto,
  SourceAssetService,
} from '../../services/source-asset.service';
import { AssetTypeEnum } from '../../../admin/source-assets-management/source-asset.model';
import { ImageCropperDialogComponent } from '../image-cropper-dialog/image-cropper-dialog.component';
import { UpscaleImageDialogComponent } from '../upscale-image-dialog/upscale-image-dialog.component';
import { finalize, Observable } from 'rxjs';
import { GalleryService } from '../../../gallery/gallery.service';

export interface MediaItemSelection {
  mediaItem: MediaItem;
  selectedIndex: number;
}

@Component({
  selector: 'app-image-selector',
  templateUrl: './image-selector.component.html',
  styleUrls: ['./image-selector.component.scss'],
})
export class ImageSelectorComponent {
  isUploading = false;

  constructor(
    public dialogRef: MatDialogRef<ImageSelectorComponent>,
    private sourceAssetService: SourceAssetService,
    private galleryService: GalleryService,
    private dialog: MatDialog,
    @Inject(MAT_DIALOG_DATA)
    public data: {
        mimeType: 'image/*' | 'image/png' | 'video/mp4' | null;
      assetType: AssetTypeEnum;
        enableUpscale?: boolean; // Added optional flag
    },
  ) { }

  handleFileSelect(file: File): void {
    if (file.type.startsWith('image/')) {
      const cropperDialogRef = this.dialog.open(ImageCropperDialogComponent, {
        data: {
          imageFile: file,
          assetType: this.data.assetType,
          enableUpscale: this.data.enableUpscale // Pass the flag
        },
        width: '600px',
      });

      cropperDialogRef.afterClosed().subscribe((result: any) => {
        if (result) {
          // Unpack the wrapper object from ImageCropperDialogComponent
          const asset = result.asset || result;

          // Check if it looks like a SourceAssetResponseDto (has id and presignedUrl)
          if (asset && asset.id && asset.presignedUrl) {
            this.dialogRef.close(asset);
          } else if (result.job) {
            // If a job was returned (e.g. upscaling started), we might want to return that.
            this.dialogRef.close(result.job);
          }
        }
      });
    } else if (file.type.startsWith('video/')) {
      this.isUploading = true;
      this.uploadVideoDirectly(file)
        .pipe(finalize(() => (this.isUploading = false)))
        .subscribe(asset => this.dialogRef.close(asset));
    }
  }

  private uploadVideoDirectly(file: File): Observable<SourceAssetResponseDto> {
    return this.sourceAssetService.uploadAsset(file);
  }

  onFileSelected(event: Event): void {
    const element = event.currentTarget as HTMLInputElement;
    const fileList: FileList | null = element.files;
    if (fileList && fileList[0]) {
      this.handleFileSelect(fileList[0]);
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer?.files[0]) {
      this.handleFileSelect(event.dataTransfer.files[0]);
    }
  }

  /**
   * Selection from the Gallery/Media list
   */
  onMediaItemSelected(selection: MediaItemSelection): void {
    if (this.data.enableUpscale && selection.mediaItem.mimeType?.startsWith('image/')) {
      const upscaleDialogRef = this.dialog.open(UpscaleImageDialogComponent, {
        data: { selection: selection.mediaItem },
        width: '450px',
        disableClose: true,
      });

      upscaleDialogRef.afterClosed().subscribe((upscaledAsset: MediaItem) => {
        // If the upscale job was started successfully in the child dialog
        if (upscaledAsset) {
          // We close the selector immediately. 
          // The job is now running in the background via the Service.
          this.dialogRef.close(upscaledAsset);
        }
      });
    } else {
      this.dialogRef.close(selection);
    }
  }

  /**
   * Selection from existing Assets
   */
  onAssetSelected(asset: SourceAssetResponseDto): void {
    if (this.data.enableUpscale && asset.mimeType.startsWith('image/')) {
      const upscaleDialogRef = this.dialog.open(UpscaleImageDialogComponent, {
        data: { asset: asset },
        width: '450px',
        disableClose: true,
      });

      upscaleDialogRef.afterClosed().subscribe((upscaledAsset: MediaItem) => {
        if (upscaledAsset) {
          // Close immediately once the user hits "Confirm" in the upscale dialog
          this.dialogRef.close(upscaledAsset);
        }
      });
    } else {
      this.dialogRef.close(asset);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }
}