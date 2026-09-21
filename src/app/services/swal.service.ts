import { Injectable } from '@angular/core';
import Swal, { SweetAlertResult } from 'sweetalert2';

@Injectable({ providedIn: 'root' })
export class SwalService {
  mensajePregunta(mensaje: string): Promise<SweetAlertResult<any>> {
    return Swal.fire({
      title: 'Confirmación',
      text: mensaje,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4da8de',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí',
      cancelButtonText: 'No',
    });
  }

  mensajeSuccess(mensaje: string, titulo = 'Correcto'): Promise<SweetAlertResult<any>> {
    return Swal.fire({
      title: titulo,
      text: mensaje,
      icon: 'success',
      confirmButtonColor: '#4da8de',
      confirmButtonText: 'Aceptar',
    });
  }

  mensajeError(mensaje: string, titulo = 'Error'): Promise<SweetAlertResult<any>> {
    return Swal.fire({
      title: titulo,
      text: mensaje,
      icon: 'error',
      confirmButtonColor: '#d33',
      confirmButtonText: 'Aceptar',
    });
  }

  mensajeWarning(mensaje: string, titulo = 'Atención'): Promise<SweetAlertResult<any>> {
    return Swal.fire({
      title: titulo,
      text: mensaje,
      icon: 'warning',
      confirmButtonColor: '#f59e0b',
      confirmButtonText: 'Aceptar',
    });
  }
}
