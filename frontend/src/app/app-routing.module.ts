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

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { LoginComponent } from './login/login.component';
import { AuthGuardService } from './common/services/auth.guard.service';
import { FunTemplatesComponent } from './fun-templates/fun-templates.component';
import { VideoComponent } from './video/video.component';
import { ArenaComponent } from './arena/arena.component';
import { MediaGalleryComponent } from './gallery/media-gallery/media-gallery.component';
import { MediaDetailComponent } from './gallery/media-detail/media-detail.component';
import { AdminAuthGuard } from './admin/admin-auth.guard';
import { VtoComponent } from './vto/vto.component';
import { AudioComponent } from './audio/audio.component';
import { UpscaleComponent } from './upscale/upscale.component';
import { UpscaleImageDialogComponent } from './common/components/upscale-image-dialog/upscale-image-dialog.component';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', component: HomeComponent, canActivate: [AuthGuardService] },
  {
    path: 'fun-templates',
    component: FunTemplatesComponent,
    canActivate: [AuthGuardService],
  },
  {path: 'video', component: VideoComponent, canActivate: [AuthGuardService]},
  {path: 'arena', component: ArenaComponent, canActivate: [AuthGuardService]},
  {path: 'vto', component: VtoComponent, canActivate: [AuthGuardService]},
  {path: 'audio', component: AudioComponent, canActivate: [AuthGuardService]},
  { path: 'imagen-upscale', component: UpscaleComponent, canActivate: [AuthGuardService] },
  // When a user goes to '/gallery', show the main feed.
  {
    path: 'gallery',
    component: MediaGalleryComponent,
  },
  // When a user goes to '/gallery/some-unique-id', show the detail page.
  // The ':id' is a placeholder for the media item's ID.
  {
    path: 'gallery/:id',
    component: MediaDetailComponent,
  },
  // Optional: Redirect the base URL to the gallery
  {
    path: '',
    redirectTo: '/gallery',
    pathMatch: 'full',
  },
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule),
    canActivate: [AdminAuthGuard],
  },
<<<<<<< HEAD
=======
  {
    path: 'workflows',
    canActivate: [AuthGuardService],
    children: [
      { path: '', component: WorkflowListComponent, pathMatch: 'full' },
      { path: 'new', component: WorkflowEditorComponent, canActivate: [AdminAuthGuard] },
      // Match the parameter names used in your WorkflowEditorComponent
      { path: 'edit/:workflowId', component: WorkflowEditorComponent, canActivate: [AdminAuthGuard] },
      { path: ':id/executions', component: ExecutionHistoryComponent },
    ],
  },
>>>>>>> develop
];

@NgModule({
  declarations: [UpscaleComponent, UpscaleImageDialogComponent],
  imports: [RouterModule.forRoot(routes), CommonModule, MatIconModule, MatDialogModule, MatButtonModule, MatProgressBarModule, MatProgressSpinnerModule, FormsModule, MatSelectModule, MatFormFieldModule],
  exports: [RouterModule],
})
export class AppRoutingModule { }
