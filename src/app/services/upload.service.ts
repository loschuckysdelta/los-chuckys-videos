import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export type UploadedFileInfo = {
  public_id: string;
  secure_url: string;
  resource_type: string;
  bytes?: number;
  width?: number;
  height?: number;
  format?: string;
};

@Injectable({ providedIn: 'root' })
export class UploadService {
  private http = inject(HttpClient);

  async upload(file: File, folder: string, type: 'image' | 'video'): Promise<UploadedFileInfo> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('folder', folder);
    form.append('type', type);
    return firstValueFrom(this.http.post<UploadedFileInfo>(`${environment.apiBackend}/uploads`, form));
  }
}
