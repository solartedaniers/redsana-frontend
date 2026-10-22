import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SessionRestoreStatus } from './shared/components/session-restore-status/session-restore-status';
import { UpdateBanner } from './shared/components/update-banner/update-banner';

@Component({
  imports: [RouterOutlet, SessionRestoreStatus, UpdateBanner],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {}
