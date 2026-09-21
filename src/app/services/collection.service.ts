import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

const base_url = environment.apiBackend + '/collections';

export type CollectionDTO = {
  _id: string;
  title: string;
  subtitle: string;
  categoryId: string | null;
  slug: string;
  status: boolean;
  order: number;
  banner: any;
  views?: number;
  likes?: number;
};

@Injectable({ providedIn: 'root' })
export class CollectionService {
  private http = inject(HttpClient);

  read_collections(): Observable<CollectionDTO[]> {
    return this.http.get<CollectionDTO[]>(`${base_url}/read_collections`);
  }

  get_collection(id: string): Observable<CollectionDTO> {
    return this.http.get<CollectionDTO>(`${base_url}/get_collection/${id}`);
  }


  create_collection(data: any): Observable<CollectionDTO> {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('subtitle', data.subtitle ?? '');
    formData.append('categoryId', data.categoryId ?? '');
    formData.append('slug', data.slug);
    formData.append('status', String(data.status));
    formData.append('order', String(data.order));
    if (data.banner) formData.append('banner', data.banner);

    return this.http.post<CollectionDTO>(`${base_url}/create_collection`, formData);
  }

  update_collection(data: any): Observable<CollectionDTO> {
    const formData = new FormData();
    formData.append('_id', data._id);
    formData.append('title', data.title);
    formData.append('subtitle', data.subtitle ?? '');
    formData.append('categoryId', data.categoryId ?? '');
    formData.append('slug', data.slug);
    formData.append('status', String(data.status));
    formData.append('order', String(data.order));

    if (data.banner instanceof File) {
      formData.append('banner', data.banner);
    }

    return this.http.put<CollectionDTO>(`${base_url}/update_collection`, formData);
  }

  delete_collection(id: string): Observable<boolean> {
    return this.http.delete<boolean>(`${base_url}/delete_collection/${id}`);
  }

  update_collections_order(
    items: { _id: string; order: number }[],
  ): Observable<{ success: boolean }> {
    return this.http.put<{ success: boolean }>(`${base_url}/update_collections_order`, { items });
  }
}
