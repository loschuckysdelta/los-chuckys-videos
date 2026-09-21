import {
  ApplicationConfig,
  importProvidersFrom,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { routes } from './app.routes';
import { BrowserModule } from '@angular/platform-browser';
import { DatePipe } from '@angular/common';
import { DialogService } from 'primeng/dynamicdialog';

export const appConfig: ApplicationConfig = {
  providers: [
    DialogService,
    importProvidersFrom([BrowserModule, DatePipe]),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: '.dark',
        },
      },
    }),
  ],
};
