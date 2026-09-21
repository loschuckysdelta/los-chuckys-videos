import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable, of, tap, finalize, shareReplay, switchMap, map } from 'rxjs';

export type CategoryDTO = {
  _id: string;
  title: string;
  order: number;
  created_at: string;
  updated_at: string;
};
@Injectable({ providedIn: 'root' })
export class CategoryService {
  private http = inject(HttpClient);
  private url = `${environment.apiBackend}/category`;
  private categoriesSubject = new BehaviorSubject<CategoryDTO[]>([]);
  readonly categories$ = this.categoriesSubject.asObservable();
  private loaded = false;
  private pending?: Observable<CategoryDTO[]>;
  private revision = 0;

  read(refresh = false): Observable<CategoryDTO[]> {
    if (!refresh && this.pending) return this.pending;
    if (!refresh && this.loaded) return of(this.categoriesSubject.value);
    const revision = ++this.revision;
    this.loaded = false;
    this.pending = this.http.get<CategoryDTO[]>(this.url).pipe(
      tap(rows => {
        if (revision !== this.revision) return;
        this.categoriesSubject.next(rows);
        this.loaded = true;
      }),
      finalize(() => { if (revision === this.revision) this.pending = undefined; }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.pending;
  }
  save(data: { title: string; order?: number }, id?: string) {
    const request = id ? this.http.put<CategoryDTO>(`${this.url}/${id}`, data) : this.http.post<CategoryDTO>(this.url, data);
    return request.pipe(switchMap(result => this.read(true).pipe(map(() => result))));
  }
  delete(id: string) {
    return this.http.delete<boolean>(`${this.url}/${id}`).pipe(
      switchMap(result => this.read(true).pipe(map(() => result))),
    );
  }
  reorder(items: { _id: string; order: number }[]) {
    return this.http.put<{ success: boolean }>(`${this.url}/order`, { items }).pipe(
      switchMap(result => this.read(true).pipe(map(() => result))),
    );
  }
}
