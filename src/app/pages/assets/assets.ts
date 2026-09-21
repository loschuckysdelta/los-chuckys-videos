import { CommonModule } from '@angular/common';
import { compactCount } from '../../utils/compact-count';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Optional,
  ViewChild,
  inject,
} from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { DialogService, DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { PrimeNGModule } from '../../utils/prime-ng.module';
import { CollectionDTO } from '../../services/collection.service';
import { AssetDTO, AssetService, BulkUploadEvent } from '../../services/assets.service';
import { SwalService } from '../../services/swal.service';
import { environment } from '../../../environments/environment';

type AssetFormValue = {
  _id: string;
  collectionId: string;
  type: 'image' | 'video';
  status: boolean;
  order: number;
  views: number;
  likes: number;
  file: any;
};

type ReorderRow = AssetDTO;

@Component({
  selector: 'app-assets',
  standalone: true,
  imports: [CommonModule, PrimeNGModule],
  templateUrl: './assets.html',
  styleUrl: './assets.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DialogService],
})
export class Assets {
  readonly compactCount = compactCount;
  readonly pendingCounters = new Set<string>();
  readonly counterEffects = new Map<string, number[]>();
  private effectSequence = 0;

  finishCounterEffect(key: string, effect: number) {
    const remaining = (this.counterEffects.get(key) ?? []).filter(id => id !== effect);
    if (remaining.length) this.counterEffects.set(key, remaining);
    else this.counterEffects.delete(key);
  }

  incrementCounter(item: AssetDTO, counter: 'view' | 'like') {
    if (this.pendingCounters.has(item._id)) return;
    this.pendingCounters.add(item._id);
    this.assetService.incrementCounter(item._id, counter).subscribe({
      next: result => {
        item.views = result.views;
        item.likes = result.likes;
        this.pendingCounters.delete(item._id);
        const key = `${item._id}:${counter}`;
        this.counterEffects.set(key, [...(this.counterEffects.get(key) ?? []), ++this.effectSequence]);
        this.cdr.markForCheck();
      },
      error: err => {
        this.pendingCounters.delete(item._id);
        this.swal.mensajeError(err?.error?.msg || 'No se pudo actualizar el contador.');
        this.cdr.markForCheck();
      },
    });
  }
  private assetService = inject(AssetService);
  private swal = inject(SwalService);
  private cdr = inject(ChangeDetectorRef);
  base_url = environment.apiBackend;
  api_url = '';
  showDocs = false;
  copiedDoc = '';
  documentationEndpoints: { title: string; url: string; description: string }[] = [];

  openDocumentation() {
    const base = new URL(this.base_url, window.location.origin).href.replace(/\/$/, '');
    const id = this.list[0]?._id || 'ID_DEL_RECURSO';
    this.documentationEndpoints = [
      { title: 'Sumar una vista', url: `${base}/resources/${id}/view`, description: 'Llama una vez al abrir el recurso en tu previsualizador. Suma 1 a views.' },
      { title: 'Sumar un like', url: `${base}/resources/${id}/like`, description: 'Llama cuando el usuario pulse tu botón de like. Suma 1 a likes.' },
    ];
    this.copiedDoc = '';
    this.showDocs = true;
  }


  async copyDocumentation(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      this.copiedDoc = url;
      this.cdr.markForCheck();
    } catch {
      this.swal.mensajeError('No se pudo copiar. Selecciona la URL y cópiala manualmente.');
    }
  }

  @ViewChild('assetFileInput') assetFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('reorderTable') reorderTable?: any;

  collection: CollectionDTO | null = null;

  list: AssetDTO[] = [];
  loading = false;

  showForm = false;
  isEditing = false;
  saving = false;

  modalReorder = false;
  reorderRows: ReorderRow[] = [];
  selectedReorderRow: ReorderRow | null = null;
  loadReorder = false;

  bulkMode = false;
  selectedFiles: File[] = [];

  bulkTotal = 0;
  bulkDone = 0;
  bulkOk = 0;
  bulkFail = 0;
  bulkRunning = false;

  private readonly base: AssetFormValue = {
    _id: '',
    collectionId: '',
    type: 'image',
    status: true,
    order: 1,
    views: 0,
    likes: 0,
    file: null,
  };

  Form = new FormGroup({
    _id: new FormControl<string>(this.base._id),
    collectionId: new FormControl<string>(this.base.collectionId, Validators.required),
    type: new FormControl<'image' | 'video'>(this.base.type),
    status: new FormControl<boolean>(this.base.status),
    views: new FormControl<number>(0, [Validators.min(0), Validators.pattern(/^[0-9]+$/)]),
    likes: new FormControl<number>(0, [Validators.min(0), Validators.pattern(/^[0-9]+$/)]),
    order: new FormControl<number>(this.base.order, Validators.required),
    file: new FormControl<any>(this.base.file),
  });

  constructor(
    @Optional() private ref: DynamicDialogRef,
    @Optional() private config: DynamicDialogConfig,
  ) {
    this.collection = (this.config?.data?.collection as CollectionDTO) || null;
  }

  private touch() {
    setTimeout(() => {
      this.saving = false;
      this.loading = false;
      this.loadReorder = false;
      this.cdr.markForCheck();
    });
  }

  ngOnInit() {
    this.read();
  }

  trackById(_: number, x: AssetDTO) {
    return x._id;
  }

  read() {
    const collectionId = this.collection?._id;
    if (!collectionId) return;

    this.loading = true;
    this.assetService.read_assets({ collectionId }).subscribe({
      next: (res) => {
        this.list = (res || []).sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
        this.api_url = `${this.base_url}/resources?gallery=${this.collection?.slug}`;
        this.touch();
      },
      error: () => {
        this.list = [];
        this.touch();
      },
    });
  }

  url(x: AssetDTO | null): string {
    const u = x?.file?.secure_url;
    return typeof u === 'string' ? u : '';
  }

  isVideo(x: AssetDTO | null): boolean {
    return String(x?.type || '') === 'video';
  }

  private inferTypeFromFile(file: File): 'image' | 'video' | null {
    const mime = String(file?.type || '').toLowerCase();
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('image/')) return 'image';
    return null;
  }

  private resetBulkState() {
    this.bulkMode = false;
    this.selectedFiles = [];
    this.bulkTotal = 0;
    this.bulkDone = 0;
    this.bulkOk = 0;
    this.bulkFail = 0;
    this.bulkRunning = false;
    this.Form.get('order')?.enable({ emitEvent: false });
    this.Form.get('type')?.enable({ emitEvent: false });
  }

  get bulkButtonLabel(): string {
    if (!this.bulkMode) return 'Guardar';
    if (!this.bulkRunning)
      return `Subir ${this.bulkTotal || this.selectedFiles.length || 0} archivos`;
    const t = this.bulkTotal || this.selectedFiles.length || 0;
    return `Subiendo ${Math.min(this.bulkDone + 1, t)}/${t}`;
  }

  openCreate() {
    const collectionId = this.collection?._id;
    if (!collectionId) return;

    const nextOrder = (this.list?.length || 0) + 1;

    this.isEditing = false;
    this.showForm = true;
    this.resetBulkState();

    this.Form.reset(this.base);
    this.Form.patchValue({
      collectionId,
      order: nextOrder,
      type: 'image',
      status: true,
      file: null,
    });

    this.clearFileInput();
    this.touch();
  }

  openEdit(item: AssetDTO) {
    const collectionId = this.collection?._id;
    if (!collectionId || !item?._id) return;

    this.isEditing = true;
    this.showForm = true;
    this.resetBulkState();

    this.Form.reset(this.base);
    this.Form.patchValue({
      _id: item._id,
      collectionId: String(item.collectionId || collectionId),
      type: (item.type as any) || 'image',
      status: !!item.status,
      views: item.views ?? 0,
      likes: item.likes ?? 0,
      order: Number(item.order ?? 1),
      file: item.file || null,
    });

    this.clearFileInput();
    this.touch();
  }

  closeForm() {
    this.showForm = false;
    this.isEditing = false;
    this.saving = false;
    this.Form.reset(this.base);
    this.resetBulkState();
    this.clearFileInput();
    this.touch();
  }

  clearFileInput() {
    if (this.assetFileInput?.nativeElement) this.assetFileInput.nativeElement.value = '';
  }

  accept(): string {
    return 'image/*,video/*';
  }

  canPickMultiple(): boolean {
    return !this.isEditing;
  }

  onFileSelected(event: any) {
    const files = Array.from((event?.target?.files as FileList | undefined) ?? []);
    if (files.length === 0) return;

    const valid = files
      .map((f) => ({ f, t: this.inferTypeFromFile(f) }))
      .filter((x) => !!x.t)
      .map((x) => x.f);

    if (valid.length === 0) {
      this.clearFileInput();
      return;
    }

    if (this.isEditing) {
      const file = valid[0];
      const inferred = this.inferTypeFromFile(file);
      if (!inferred) {
        this.clearFileInput();
        return;
      }
      this.resetBulkState();
      this.Form.patchValue({ file, type: inferred });
      this.touch();
      return;
    }

    this.selectedFiles = valid;
    this.bulkMode = valid.length > 1;
    this.bulkTotal = valid.length;
    this.bulkDone = 0;
    this.bulkOk = 0;
    this.bulkFail = 0;
    this.bulkRunning = false;

    if (this.bulkMode) {
      this.Form.get('order')?.disable({ emitEvent: false });
      this.Form.get('type')?.disable({ emitEvent: false });
      this.Form.patchValue({ file: null });
    } else {
      this.Form.get('order')?.enable({ emitEvent: false });
      this.Form.get('type')?.enable({ emitEvent: false });
      const only = valid[0];
      const inferred = this.inferTypeFromFile(only);
      this.Form.patchValue({
        file: only,
        type: inferred ?? 'image',
      });
    }

    this.touch();
  }

  private prettyBulkError(err: any): string {
    const status = Number(err?.status ?? err?.error?.status ?? 0);
    if (status === 413) {
      return 'No se subió porque el archivo es demasiado grande (supera el límite permitido por el servidor).';
    }
    const msg = String(err?.error?.message || err?.error?.msg || err?.message || '').trim();
    return msg || 'No se pudo subir el archivo por un error.';
  }

  private prettyUploadError(err: any): string {
    const cldMsg = String(err?.error?.error?.message || err?.error?.message || '').trim();

    if (cldMsg.toLowerCase().includes('file size too large')) {
      const got = Number(cldMsg.match(/got\s+(\d+)/i)?.[1] || 0);
      const max = Number(cldMsg.match(/maximum\s+is\s+(\d+)/i)?.[1] || 0);

      if (got && max) {
        const toMB = (n: number) => Math.round((n / 1024 / 1024) * 10) / 10;
        return `No se subió el video porque excede el tamaño máximo permitido (${toMB(got)} MB). Máximo permitido: ${toMB(max)} MB.`;
      }

      return 'No se subió el video porque excede el tamaño máximo permitido por el servidor.';
    }

    return 'No se pudo subir el archivo.';
  }

  submit() {
    if (this.bulkRunning) return;

    if (this.Form.invalid) {
      Object.values(this.Form.controls).forEach((c) => {
        c.markAsTouched();
        c.markAsDirty();
      });
      return;
    }

    const data: any = this.Form.value;
    const isCreate = !data._id;

    console.log(data);

    if (!isCreate) {
      const obs = this.assetService.update_asset(data);
      this.saving = true;
      obs.subscribe({
        next: () => {
          this.read();
          this.touch();
          this.closeForm();
        },
        error: () => {
          this.touch();
        },
      });
      return;
    }

    if (this.bulkMode) {
      const collectionId = this.collection?._id;
      if (!collectionId) return;

      const files = [...this.selectedFiles];
      if (files.length === 0) {
        this.swal.mensajeWarning('Debe subir al menos un archivo');
        return;
      }

      const startOrder = (this.list?.length || 0) + 1;
      const status = typeof data.status === 'boolean' ? data.status : true;

      this.bulkTotal = files.length;
      this.bulkDone = 0;
      this.bulkOk = 0;
      this.bulkFail = 0;
      this.bulkRunning = true;
      this.saving = true;
      this.cdr.markForCheck();

      this.assetService
        .create_assets_bulk({
          collectionId,
          files,
          status,
          startOrder,
          views: Number(data.views ?? 0),
          likes: Number(data.likes ?? 0),
        })
        .subscribe({
          next: (ev: BulkUploadEvent) => {
            if (ev.kind === 'progress') {
              this.bulkDone = ev.done;
              this.bulkOk = ev.ok;
              this.bulkFail = ev.fail;
              this.cdr.markForCheck();
            }

            if (ev.kind === 'error' && ev.error) {
              this.swal.mensajeWarning(
                `${this.prettyBulkError(ev.error)} (${ev.filename || 'archivo'})`,
              );
              this.cdr.markForCheck();
            }

            if (ev.kind === 'done') {
              this.bulkDone = ev.done;
              this.bulkOk = ev.ok;
              this.bulkFail = ev.fail;
              this.bulkRunning = false;
              this.saving = false;
              this.read();
              this.touch();
              this.closeForm();
            }
          },
          error: () => {
            this.bulkRunning = false;
            this.touch();
          },
        });

      return;
    }

    const file = data.file instanceof File ? (data.file as File) : null;
    if (!file) {
      this.swal.mensajeWarning('Debe subir un archivo para crear el recurso');
      return;
    }

    const inferred = this.inferTypeFromFile(file);
    if (!inferred) {
      this.clearFileInput();
      return;
    }

    const payload = {
      collectionId: data.collectionId,
      type: inferred,
      status: typeof data.status === 'boolean' ? data.status : true,
      order: Number(data.order ?? (this.list?.length || 0) + 1),
      file,
      views: Number(data.views ?? 0),
      likes: Number(data.likes ?? 0),
    };

    const obs = this.assetService.create_asset(payload);

    this.saving = true;
    obs.subscribe({
      next: () => {
        this.read();
        this.touch();
        this.closeForm();
      },
      error: (err) => {
        this.touch();
        this.swal.mensajeWarning(this.prettyUploadError(err));
      },
    });
  }

  deleteItem(item: AssetDTO) {
    if (!item?._id) return;

    this.swal.mensajePregunta('¿Seguro que desea eliminar este recurso?').then((r) => {
      if (!r.isConfirmed) return;

      this.loading = true;
      this.assetService.delete_asset(item._id).subscribe({
        next: (ok) => {
          if (ok) this.read();
        },
        error: () => {
          this.touch();
        },
      });
    });
  }

  onOpenReorder() {
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
    const collectionId = this.collection?._id;
    if (!collectionId) return;

    const items = this.reorderRows.map((x, idx) => ({ _id: x._id, order: idx + 1 }));

    this.loadReorder = true;
    this.assetService.update_assets_order(collectionId, items).subscribe({
      next: (resp: any) => {
        if (resp && resp.success === false) {
          this.touch();
          return;
        }
        this.modalReorder = false;
        this.reorderRows = [];
        this.selectedReorderRow = null;
        this.read();
        this.touch();
      },
      error: () => {
        this.touch();
      },
    });
  }

  closeGallery() {
    this.ref?.close(true);
  }

  copiarUrl() {
    if (!this.api_url) return;

    navigator.clipboard
      .writeText(this.api_url)
      .then(() => {
        console.log('URL copiada');
      })
      .catch(() => {
        console.error('No se pudo copiar');
      });
  }
}
