import { AfterViewInit, Component, ElementRef, EventEmitter, OnDestroy, Output, ViewChild } from '@angular/core';
import { fromEvent, Subject, takeUntil, throttleTime } from 'rxjs';

import { uuid } from '../../utils/uuid';

export interface SpeekDraw {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  y?: number;
  x?: number;
  color: string;
}

export type DrawEvent =
  | 'mousedown'
  | 'mouseup'
  | 'mouseout'
  | 'mousemove'
  | 'touchstart'
  | 'touchend'
  | 'touchcancel'
  | 'touchmove';

@Component({
  selector: 'speek-board',
  templateUrl: './board.component.html',
  styleUrls: ['./board.component.scss'],
})
export class BoardComponent implements AfterViewInit, OnDestroy {
  destroy = new Subject<void>();

  @Output()
  draw = new EventEmitter<SpeekDraw>();

  sender = uuid();
  code!: string;

  current: SpeekDraw = {
    color: '#000000',
    x0: 0,
    y0: 0,
    x1: 0,
    y1: 0,
    x: 0,
    y: 0
  };

  drawing = false;

  @ViewChild('canvas')
  canvasRef!: ElementRef<HTMLCanvasElement>
  canvas!: HTMLCanvasElement;
  context!: CanvasRenderingContext2D;

  @ViewChild('colors')
  colorsRef!: ElementRef<HTMLDivElement>;
  colors!: HTMLDivElement;

  ngAfterViewInit(): void {
    this.canvas = this.canvasRef.nativeElement;
    this.context = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    this.colors = this.colorsRef.nativeElement;

    this.colors.childNodes.forEach((node) => {
      node.addEventListener('click', this.onColorUpdate);
    });

    this.observe('mousedown').subscribe(this.onMouseDown);
    this.observe('mouseup').subscribe(this.onMouseUp);
    this.observe('mouseout').subscribe(this.onMouseUp);
    this.observe('mousemove', 50).subscribe(this.onMouseMove);

    this.observe('touchstart').subscribe(this.onMouseDown);
    this.observe('touchend').subscribe(this.onMouseUp);
    this.observe('touchcancel').subscribe(this.onMouseUp);
    this.observe('touchmove', 50).subscribe(this.onMouseMove);

    this.draw
      .pipe(takeUntil(this.destroy))
      .subscribe((data) => this.onDrawing(data));

    fromEvent<UIEvent>(window, 'resize')
      .pipe(takeUntil(this.destroy))
      .subscribe(this.onResize);

    this.onResize();
  }

  observe(event: DrawEvent, throttle = 0) {
    const observer = fromEvent<MouseEvent>(this.canvas, event);
    return throttle
      ? observer.pipe(throttleTime(throttle), takeUntil(this.destroy))
      : observer.pipe(takeUntil(this.destroy));
  }

  onColorUpdate() {
    return ({ target }: { target: HTMLElement }) => {
      this.current.color = target.className.split(' ')[1];
    };
  }

  ngOnDestroy(): void {
    this.destroy.next();
    this.destroy.complete();
  }

  onMouseDown() {
    return ({ clientX, clientY, touches }: MouseEvent & TouchEvent) => {
      this.drawing = true;
      this.current.x = clientX || touches.item(0)?.clientX || 0;
      this.current.y = clientY || touches.item(0)?.clientY || 0;
    };
  }

  onMouseUp() {
    return (e: MouseEvent & TouchEvent) => {
      if (!this.drawing) {
        return;
      }
  
      const { x = 0, y = 0, color } = this.current;
      const { clientX, clientY } = this.getPosition(e);
  
      this.drawing = false;
      this.drawLine(x, y, clientX, clientY, color, true);
    };
  }

  onMouseMove() {
    return (e: MouseEvent & TouchEvent) => {
      if (!this.drawing) {
        return;
      }
  
      const { x = 0, y = 0, color } = this.current;
      const { clientX, clientY } = this.getPosition(e);
  
      this.drawLine(x, y, clientX, clientY, color, true);
  
      this.current.x = clientX;
      this.current.y = clientY;
    };
  }

  getPosition({ clientX, clientY, touches }: MouseEvent & TouchEvent) {
    const x = clientX || touches[0].clientX;
    const y = clientY || touches[0].clientY;

    return { clientX: x, clientY: y };
  }

  drawLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: string,
    emit: boolean = false
  ) {
    this.context.beginPath();
    this.context.moveTo(x0, y0);
    this.context.lineTo(x1, y1);
    this.context.strokeStyle = String(color);
    this.context.lineWidth = 2;
    this.context.stroke();
    this.context.closePath();

    

    if (!emit) {
      return;
    }
    
    const w = this.canvas.width;
    const h = this.canvas.height;

    this.draw.emit({
      x0: x0 / w,
      y0: y0 / h,
      x1: x1 / w,
      y1: y1 / h,
      color: color,
    });
  }

  onDrawing = (data: SpeekDraw) => {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.drawLine(
      data.x0 * w,
      data.y0 * h,
      data.x1 * w,
      data.y1 * h,
      data.color
    );
  };

  onResize = () => {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  };
}
