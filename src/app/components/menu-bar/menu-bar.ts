import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MenubarModule } from 'primeng/menubar';
import { MenuItem } from 'primeng/api';

@Component({
  selector: 'app-menu-bar',
  imports: [MenubarModule],
  templateUrl: './menu-bar.html',
})
export class MenuBar {
  items: MenuItem[] = [
    {
      label: 'Colección',
      icon: 'pi pi-list',
      command: () => this.router.navigateByUrl('/'),
    },
    {
      label: 'Categorías',
      icon: 'pi pi-tags',
      command: () => this.router.navigateByUrl('/category'),
    },
  ];

  constructor(private router: Router) {}
}
