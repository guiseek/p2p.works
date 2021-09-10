import { LayoutModule } from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { RouterModule, Routes } from '@angular/router';

import { ConfigComponent } from './config/config.component';
import { ConfigGuard } from './config/config.guard';
import { MeetComponent } from './meet.component';
import { MeetGuard } from './meet.guard';
import { BoardComponent } from './board/board.component';
import { BoardDirective } from './board/board.directive';


const routes: Routes = [
  { path: ':meet', component: MeetComponent, canActivate: [ConfigGuard, MeetGuard] }
];

@NgModule({
  declarations: [
    MeetComponent,
    ConfigComponent,
    BoardComponent,
    BoardDirective
  ],
  imports: [
    CommonModule,
    LayoutModule,
    ReactiveFormsModule,
    MatCardModule,
    MatSelectModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    RouterModule.forChild(routes)
  ],
  providers: [MeetGuard, ConfigGuard]
})
export class MeetModule { }
