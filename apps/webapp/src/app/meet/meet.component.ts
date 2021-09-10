import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Peer } from '@speek/ports';

@Component({
  selector: 'speek-meet',
  templateUrl: './meet.component.html',
  styleUrls: ['./meet.component.scss'],
})
export class MeetComponent implements OnInit {
  meet: string;
  
  constructor(
    readonly route: ActivatedRoute,
    private _router: Router,
    readonly peer: Peer
  ) {
    const { meet } = this.route.snapshot.params;
    if (meet) this.meet = meet;
    else this.meet = '';
  }

  ngOnInit(): void {
    this.peer.connect(this.meet);
  }

  onConnect() {
    this.peer.on('data', (data) => {
      console.log(data);
    });
  }

  onFileChange(files: FileList) {
    const file = files.item(0);

    if (file) {
      this.peer.upload(file);
    }
  }

  end() {
    this.peer.close();
    this._router.navigate(['/']);
  }
}
