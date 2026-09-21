// src/app/pages/collection/collection.ts
import { CategoryService } from '../../services/category.service';
import { CommonModule } from '@angular/common';
import { compactCount } from '../../utils/compact-count';
import { environment } from '../../../environments/environment';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { CollectionDTO, CollectionService } from '../../services/collection.service';
import { PrimeNGModule } from '../../utils/prime-ng.module';
import { DialogService } from 'primeng/dynamicdialog';
import { Assets } from '../assets/assets';
import { SwalService } from '../../services/swal.service';

type ReorderRow = CollectionDTO;

type CollectionFormValue = {
  _id: string;
  title: string;
  subtitle: string;
  categoryId: string | null;
  slug: string;
  status: boolean;
  order: number;
  banner: any;
};

@Component({
  selector: 'app-collection',
  imports: [CommonModule, PrimeNGModule],
  templateUrl: './collection.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DialogService],
})
export class Collection implements OnInit {
  readonly resourcesUrl = new URL(
    `${environment.apiBackend.replace(/\/$/, '')}/resources`, window.location.origin,
  ).href;

  async copyResourcesUrl() {
    try {
      await navigator.clipboard.writeText(this.resourcesUrl);
    } catch {
      this.swal.mensajeError('No se pudo copiar. Selecciona la URL y cópiala manualmente.');
    }
  }
  readonly compactCount = compactCount;
  private collectionService = inject(CollectionService);
  private categoryService = inject(CategoryService);
  readonly categories$ = this.categoryService.categories$;
  private dialogService = inject(DialogService);
  private cdr = inject(ChangeDetectorRef);
  private swal = inject(SwalService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('reorderTable') reorderTable?: any;

  list: CollectionDTO[] = [];

  modal = false;
  modalTitle = '';
  editing: CollectionDTO | null = null;
  blockSlug: RegExp = /^[a-z0-9_-]+$/;

  modalReorder = false;
  modalReorderTitle = 'ORDENAR COLLECTIONS';
  reorderRows: ReorderRow[] = [];
  selectedReorderRow: ReorderRow | null = null;

  loadList = false;
  loadButton = false;
  loadReorder = false;

  private readonly myForm: CollectionFormValue = {
    _id: '',
    title: '',
    subtitle: '',
    categoryId: null,
    slug: '',
    status: true,
    order: 0,
    banner: null,
  };

  Form = new FormGroup({
    _id: new FormControl<string>(this.myForm._id),
    title: new FormControl<string>(this.myForm.title, Validators.required),
    subtitle: new FormControl<string>(this.myForm.subtitle),
    categoryId: new FormControl<string | null>(null),
    slug: new FormControl<string>(this.myForm.slug, Validators.required),
    status: new FormControl<boolean>(this.myForm.status, Validators.required),
    order: new FormControl<number>(this.myForm.order, Validators.required),
    banner: new FormControl<any>(this.myForm.banner),
  });

  private touch() {
    setTimeout(() => {
      this.loadList = false;
      this.loadButton = false;
      this.loadReorder = false;
      this.cdr.markForCheck();
    });
  }
  private clearFileInput() {
    if (this.fileInput?.nativeElement) this.fileInput.nativeElement.value = '';
  }

  private resetFormValue() {
    this.clearFileInput();
    this.Form.reset(this.myForm);
    this.loadButton = false;
    this.touch();
  }

  ngOnInit() { this.onRead(); }

  onRead() {
    this.loadList = true;
    this.collectionService.read_collections().subscribe({
      next: (res) => {
        this.list = res || [];
        this.touch();
      },
      error: () => {
        this.list = [];
        this.touch();
      },
    });
  }

  onFileSelected(event: any) {
    const file = event?.target?.files?.[0];
    if (file) {
      this.Form.patchValue({ banner: file });
      this.touch();
    }
  }

  onReset() {
    this.resetFormValue();
  }

  onOpen(item: CollectionDTO | null) {
    this.categoryService.read().subscribe({
      error: () => this.swal.mensajeError('No se pudieron cargar las categorías.'),
    });
    this.editing = item;
    this.modal = true;
    this.modalTitle = item ? 'Editar Collection' : 'Nueva Collection';

    this.clearFileInput();

    if (!item) {
      this.Form.reset(this.myForm);
      this.touch();
      return;
    }

    this.Form.patchValue({
      _id: item._id || null,
      title: item.title || null,
      subtitle: item.subtitle || '',
      categoryId: item.categoryId ?? null,
      slug: item.slug || null,
      status: !!item.status,
      order: Number(item.order ?? 0),
      banner: item.banner || null,
    });

    this.touch();
  }

  onSubmit() {
    if (this.Form.invalid) {
      Object.values(this.Form.controls).forEach((c) => {
        c.markAsTouched();
        c.markAsDirty();
      });
      return;
    }

    const dataform: any = this.Form.value;
    const file = dataform.banner instanceof File ? (dataform.banner as File) : null;
    const isCreate = !this.editing;

    if (isCreate && !file) {
      this.swal.mensajeWarning('Debe subir una imagen para crear la colección');
      return;
    }

    const obs = isCreate
      ? this.collectionService.create_collection(dataform)
      : this.collectionService.update_collection(dataform);

    this.loadButton = true;
    this.touch();

    obs.subscribe({
      next: (resp) => {
        if (!resp) return;
        this.modal = false;
        this.resetFormValue();
        this.onRead();
        this.touch();
        this.swal.mensajeSuccess('Colección guardada correctamente');
      },
      error: (err) => {
        this.touch();
        this.swal.mensajeError(err?.error?.msg || 'Error al guardar la colección');
      },
    });
  }

  onDelete(item: CollectionDTO) {
    if (!item?._id) return;

    this.swal.mensajePregunta('¿Seguro que desea eliminar este recurso?').then((r) => {
      if (!r.isConfirmed) return;

      this.loadList = true;
      this.collectionService.delete_collection(item._id).subscribe({
        next: (ok) => {
          if (ok) this.onRead();
        },
        error: (err) => {
          this.swal.mensajeError(err.error?.msg);
          this.touch();
        },
      });
    });
  }


  onOpenReorder() {
    this.loadReorder = true;
    const rows = (this.list || [])
      .map((x) => ({ ...x }))
      .sort((a, b) => {
        const ao = Number(a?.order ?? 0);
        const bo = Number(b?.order ?? 0);
        if (ao !== bo) return ao - bo;
        return String(a?._id ?? '').localeCompare(String(b?._id ?? ''));
      });

    this.reorderRows = rows;
    this.selectedReorderRow = rows[0] ?? null;
    this.modalReorder = true;
    this.touch();
  }

  onSelectReorderRow(row: ReorderRow) {
    this.selectedReorderRow = row;
    this.touch();
  }

  getSelectedReorderIndex(): number {
    const id = this.selectedReorderRow?._id;
    if (!id) return -1;
    return this.reorderRows.findIndex((x) => x?._id === id);
  }

  canMoveReorderUp(): boolean {
    return this.getSelectedReorderIndex() > 0;
  }

  canMoveReorderDown(): boolean {
    const i = this.getSelectedReorderIndex();
    return i >= 0 && i < this.reorderRows.length - 1;
  }

  moveReorderUp() {
    const i = this.getSelectedReorderIndex();
    if (i <= 0) return;

    const rows = [...this.reorderRows];
    [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]];
    this.reorderRows = rows;
    this.selectedReorderRow = rows[i - 1] ?? null;
    this.scrollToSelectedReorderRow();
    this.touch();
  }

  moveReorderDown() {
    const i = this.getSelectedReorderIndex();
    if (i < 0 || i >= this.reorderRows.length - 1) return;

    const rows = [...this.reorderRows];
    [rows[i + 1], rows[i]] = [rows[i], rows[i + 1]];
    this.reorderRows = rows;
    this.selectedReorderRow = rows[i + 1] ?? null;
    this.scrollToSelectedReorderRow();
    this.touch();
  }

  private scrollToSelectedReorderRow() {
    const id = this.selectedReorderRow?._id;
    if (!id) return;

    queueMicrotask(() => {
      const scroller: HTMLElement | null =
        this.reorderTable?.el?.nativeElement?.querySelector('.p-datatable-wrapper') ??
        this.reorderTable?.containerViewChild?.nativeElement ??
        null;

      if (!scroller) return;

      const rowEl = scroller.querySelector<HTMLElement>(`tr[data-reorder-id="${id}"]`);
      if (!rowEl) return;

      requestAnimationFrame(() => {
        rowEl.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      });
    });
  }

  onSaveReorder() {
    const items = this.reorderRows.map((x, idx) => ({ _id: x._id, order: idx + 1 }));

    this.loadReorder = true;
    this.collectionService.update_collections_order(items).subscribe({
      next: (resp) => {
        if (!resp?.success) return;
        this.modalReorder = false;
        this.reorderRows = [];
        this.selectedReorderRow = null;
        this.onRead();
        this.touch();
      },
      error: () => {
        this.touch();
      },
    });
  }

  onOpenGallery(row: CollectionDTO) {
    if (!row?._id) return;

    const ref = this.dialogService.open(Assets, {
      header: `${row.title || ''}`,
      width: '920px',
      modal: true,
      dismissableMask: true,
      closable: true,
      data: { collection: row },
    });

    ref?.onClose.subscribe((changed) => {
      if (changed) this.touch();
    });
  }

  onSlugInput() {
    const control = this.Form.controls.slug;
    let value = control.value || '';

    value = value
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '')
      .replace(/[-_]{2,}/g, (m) => m[0])
      .replace(/^[-_]+/, '')
      .replace(/[-_]+$/, '');

    control.setValue(value, { emitEvent: false });
  }
}
