// src/app/app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: 'category', loadComponent: () => import('./pages/category/category').then(m => m.Category) },
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./pages/collection/collection').then((m) => m.Collection),
  },
  { path: '**', redirectTo: '' },
];
