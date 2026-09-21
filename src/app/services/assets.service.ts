import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of } from 'rxjs';
import { catchError, concatMap, map, switchMap, startWith, endWith, scan } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import { UploadService, UploadedFileInfo } from './upload.service';

const base_url = environment.apiBackend + '/assets';

export type AssetDTO = {
  _id: string;
  collectionId: string;
  title: string;
  file: any;
  type: 'image' | 'video';
  status: boolean;
  order: number;
  views: number;
  likes: number;
};

export type BulkUploadEvent =
  | { kind: 'progress'; total: number; done: number; ok: number; fail: number }
  | {
      kind: 'error';
      total: number;
      done: number;
      ok: number;
      fail: number;
      filename: string;
      error: any;
    }
  | { kind: 'done'; total: number; done: number; ok: number; fail: number };

@Injectable({ providedIn: 'root' })
export class AssetService {
  private http = inject(HttpClient);
  private uploader = inject(UploadService);
  incrementCounter(id: string, counter: 'view' | 'like') {
    return this.http.post<{ _id: string; views: number; likes: number }>(
      `${environment.apiBackend}/resources/${id}/${counter}`, null,
    );
  }

  read_assets(params: {
    collectionId: string;
    type?: 'image' | 'video';
    status?: boolean;
  }): Observable<AssetDTO[]> {
    const q: any = { collectionId: params.collectionId };
    if (params.type) q.type = params.type;
    if (typeof params.status !== 'undefined') q.status = params.status;

    const qs = new URLSearchParams(q).toString();
    return this.http.get<AssetDTO[]>(`${base_url}/read_assets?${qs}`);
  }

  get_asset(id: string): Observable<AssetDTO> {
    return this.http.get<AssetDTO>(`${base_url}/get_asset/${id}`);
  }

  create_asset(data: {
    collectionId: string;
    title?: string;
    type: 'image' | 'video';
    status: boolean;
    views?: number;
    likes?: number;
    order?: number;
    file: File;
  }): Observable<AssetDTO> {
    const folder = `${data.collectionId}/gallery`;


    return from(this.uploader.upload(data.file, folder, data.type)).pipe(
      switchMap((fileInfo: UploadedFileInfo) => {
        const payload = {
          collectionId: data.collectionId,
          title: data.title ?? '',
          type: data.type,
          status: data.status,
          views: Number(data.views ?? 0),
          likes: Number(data.likes ?? 0),
          order: Number(data.order ?? 0),
          file: fileInfo,
        };
        return this.http.post<AssetDTO>(`${base_url}/create_asset`, payload);
      }),
    );
  }

  create_assets_bulk(data: {
    collectionId: string;
    files: File[];
    status: boolean;
    views?: number;
    likes?: number;
    startOrder: number;
  }): Observable<BulkUploadEvent> {
    const folder = `${data.collectionId}/gallery`;
    const total = data.files.length;

    const normalizeTitle = (file: File) => {
      const name = String(file?.name || '').trim();
      if (!name) return '';
      const idx = name.lastIndexOf('.');
      return (idx > 0 ? name.slice(0, idx) : name).trim();
    };

    const inferType = (file: File): 'image' | 'video' | null => {
      const mime = String(file?.type || '').toLowerCase();
      if (mime.startsWith('video/')) return 'video';
      if (mime.startsWith('image/')) return 'image';
      return null;
    };

    type Step = { t: 'ok' } | { t: 'fail'; filename: string; error: any };

    const steps$ = from(data.files).pipe(
      concatMap((file, idx) => {
        const type = inferType(file);
        if (!type)
          return of<Step>({
            t: 'fail',
            filename: file?.name || 'archivo',
            error: { message: 'Tipo no soportado' },
          });

        return from(this.uploader.upload(file, folder, type)).pipe(
          switchMap((fileInfo: UploadedFileInfo) => {
            const payload = {
              collectionId: data.collectionId,
              title: normalizeTitle(file),
              type,
              status: data.status,
              views: Number(data.views ?? 0),
              likes: Number(data.likes ?? 0),
              order: Number(data.startOrder + idx),
              file: fileInfo,
            };
            return this.http.post<AssetDTO>(`${base_url}/create_asset`, payload);
          }),
          map(() => ({ t: 'ok' as const })),
          catchError((error) => of<Step>({ t: 'fail', filename: file?.name || 'archivo', error })),
        );
      }),
    );

    return steps$.pipe(
      scan(
        (state, step) => {
          const nextDone = state.done + 1;
          const nextOk = state.ok + (step.t === 'ok' ? 1 : 0);
          const nextFail = state.fail + (step.t === 'fail' ? 1 : 0);

          if (step.t === 'fail') {
            return {
              total,
              done: nextDone,
              ok: nextOk,
              fail: nextFail,
              lastError: { filename: step.filename, error: step.error },
            };
          }

          return {
            total,
            done: nextDone,
            ok: nextOk,
            fail: nextFail,
            lastError: null as null | { filename: string; error: any },
          };
        },
        {
          total,
          done: 0,
          ok: 0,
          fail: 0,
          lastError: null as null | { filename: string; error: any },
        },
      ),
      concatMap((s) => {
        const evs: BulkUploadEvent[] = [];
        if (s.lastError) {
          evs.push({
            kind: 'error',
            total: s.total,
            done: s.done,
            ok: s.ok,
            fail: s.fail,
            filename: s.lastError.filename,
            error: s.lastError.error,
          });
        }
        evs.push({ kind: 'progress', total: s.total, done: s.done, ok: s.ok, fail: s.fail });
        return from(evs);
      }),
      startWith({ kind: 'progress', total, done: 0, ok: 0, fail: 0 } as BulkUploadEvent),
      endWith({ kind: 'done', total, done: total, ok: 0, fail: 0 } as BulkUploadEvent),
      scan((prev, curr) => {
        if (curr.kind !== 'done') return curr;
        const lastProgress = prev.kind === 'progress' ? prev : prev.kind === 'error' ? prev : null;
        if (!lastProgress) return curr;
        return {
          kind: 'done',
          total,
          done: lastProgress.done,
          ok: lastProgress.ok,
          fail: lastProgress.fail,
        } as BulkUploadEvent;
      }),
    );
  }

  update_asset(data: {
    _id: string;
    collectionId: string;
    title?: string;
    type: 'image' | 'video';
    status: boolean;
    views?: number;
    likes?: number;
    order?: number;
    file?: File | any;
  }): Observable<AssetDTO> {
    const hasNewFile = data.file instanceof File;

    if (!hasNewFile) {
      const payload = {
        _id: data._id,
        collectionId: data.collectionId,
        title: data.title ?? '',
        type: data.type,
        status: data.status,
        views: Number(data.views ?? 0),
        likes: Number(data.likes ?? 0),
        order: Number(data.order ?? 0),
        file: data.file,
      };

      console.log(payload);
      return this.http.put<AssetDTO>(`${base_url}/update_asset`, payload);
    }

    const folder = `${data.collectionId}/gallery`;

    return from(this.uploader.upload(data.file as File, folder, data.type)).pipe(
      switchMap((fileInfo: UploadedFileInfo) => {
        const payload = {
          _id: data._id,
          collectionId: data.collectionId,
          title: data.title ?? '',
          type: data.type,
          status: data.status,
          views: Number(data.views ?? 0),
          likes: Number(data.likes ?? 0),
          order: Number(data.order ?? 0),
          file: fileInfo,
        };
        return this.http.put<AssetDTO>(`${base_url}/update_asset`, payload);
      }),
    );
  }

  delete_asset(id: string): Observable<boolean> {
    return this.http.delete<boolean>(`${base_url}/delete_asset/${id}`);
  }

  update_assets_order(
    collectionId: string,
    items: { _id: string; order: number }[],
  ): Observable<{ success: boolean }> {
    return this.http.put<{ success: boolean }>(`${base_url}/update_assets_order`, {
      collectionId,
      items,
    });
  }
}
