import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { PeerImpl, SignalingImpl } from '@speek/adapters';
import { Peer, Signaling, Socket } from '@speek/ports';

import { environment } from '../environments/environment';
import { AppComponent } from './app.component';
import { HomeComponent } from './home/home.component';

@NgModule({
  declarations: [AppComponent, HomeComponent],
  imports: [
    BrowserModule,
    MatIconModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatFormFieldModule,
    ReactiveFormsModule,
    BrowserAnimationsModule,
    RouterModule.forRoot(
      [
        {
          path: '',
          component: HomeComponent
        },
        {
          path: 'meet',
          loadChildren: () =>
            import('./meet/meet.module').then((m) => m.MeetModule),
        },
      ],
      { initialNavigation: 'enabledBlocking' }
    ),
  ],
  providers: [
    {
      provide: Signaling,
      useFactory: () => {
        return new SignalingImpl(environment.signaling);
      },
    },
    {
      provide: Peer,
      useFactory: (signaling: Signaling<Socket>) => {
        return new PeerImpl({ iceServers: environment.iceServers }, signaling);
      },
      deps: [Signaling],
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
