import { Component, ChangeDetectorRef, afterNextRender, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { PrimeNGModule } from '../../utils/prime-ng.module';
import { CategoryDTO, CategoryService } from '../../services/category.service';
import { SwalService } from '../../services/swal.service';

@Component({
  selector: 'app-category',
  imports: [CommonModule, PrimeNGModule],
  templateUrl: './category.html',
})
export class Category {
  private service = inject(CategoryService);
  private swal = inject(SwalService);
  private cdr = inject(ChangeDetectorRef);
  list: CategoryDTO[] = [];
  loading = false;
  saving = false;
  modal = false;
  editing: CategoryDTO | null = null;
  modalReorder = false;
  savingOrder = false;
  reorderRows: CategoryDTO[] = [];
  selectedReorderRow: CategoryDTO | null = null;

  openReorder() {
    this.reorderRows = this.list.map(row => ({ ...row })).sort((a, b) => a.order - b.order || a._id.localeCompare(b._id));
    this.selectedReorderRow = this.reorderRows[0] ?? null;
    this.modalReorder = true;
  }
  get selectedIndex() {
    return this.reorderRows.findIndex(row => row._id === this.selectedReorderRow?._id);
  }
  moveOrder(direction: number) {
    const index = this.selectedIndex;
    const next = index + direction;
    if (this.savingOrder || index < 0 || next < 0 || next >= this.reorderRows.length) return;
    const rows = [...this.reorderRows];
    [rows[index], rows[next]] = [rows[next], rows[index]];
    this.reorderRows = rows;
  }
  saveOrder() {
    if (this.savingOrder || !this.reorderRows.length) return;
    this.savingOrder = true;
    this.service.reorder(this.reorderRows.map((row, index) => ({ _id: row._id, order: index + 1 }))).subscribe({
      next: () => { this.savingOrder = false; this.modalReorder = false; this.read(); },
      error: err => { this.savingOrder = false; this.error(err); },
    });
  }
  form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/\S/)] }),
  });
  constructor() {
    afterNextRender(() => this.read());
  }
  read(refresh = false) {
    this.loading = true;
    this.cdr.markForCheck();
    this.service.read(refresh).subscribe({
      next: rows => { this.list = rows; this.loading = false; this.cdr.markForCheck(); },
      error: err => { this.loading = false; this.error(err); },
    });
  }
  open(row: CategoryDTO | null) {
    this.editing = row;
    this.form.reset({ title: row?.title ?? '' });
    this.modal = true;
  }
  save() {
    if (this.form.invalid || this.saving) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    const data = this.form.getRawValue();
    this.service.save({ title: data.title.trim(), ...(!this.editing ? { order: this.list.length + 1 } : {}) }, this.editing?._id).subscribe({
      next: () => { this.saving = false; this.modal = false; this.read(); },
      error: err => { this.saving = false; this.error(err); },
    });
  }
  remove(row: CategoryDTO) {
    this.swal.mensajePregunta('¿Eliminar esta categoría?').then(result => {
      if (!result.isConfirmed) return;
      this.service.delete(row._id).subscribe({ next: () => this.read(), error: err => this.error(err) });
    });
  }
  private error(err: any) {
    this.swal.mensajeError(err?.error?.msg || 'No se pudo completar la operación.');
    this.cdr.markForCheck();
  }
}
