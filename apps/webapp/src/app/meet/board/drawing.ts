export class Drawing {
  isDrawing: boolean;
  offsetLeft: number;
  offsetTop: number;

  context: CanvasRenderingContext2D | null;

  constructor(public canvas: HTMLCanvasElement, public saveButton: HTMLButtonElement, public loadInput: HTMLInputElement) {
    this.isDrawing = false;

    canvas.addEventListener('mousedown', () => this.startDrawing());
    canvas.addEventListener('mousemove', (event) => this.draw(event));
    canvas.addEventListener('mouseup', () => this.stopDrawing());

    saveButton.addEventListener('click', () => this.save());
    loadInput.addEventListener('change', (event) => this.load(event));

    const rect = canvas.getBoundingClientRect();

    this.offsetLeft = rect.left;
    this.offsetTop = rect.top;

    this.canvas = canvas;
    this.context = this.canvas.getContext('2d');
  }
  startDrawing() {
    this.isDrawing = true;
  }
  stopDrawing() {
    this.isDrawing = false;
  }

  draw(event: MouseEvent) {
    if (this.isDrawing) {
      this.context?.fillRect(event.pageX - this.offsetLeft, event.pageY - this.offsetTop, 2, 2);
    }
  }
  save() {
    const data = this.canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = data;
    a.download = 'image.png';
    a.click();
  }

  load(event: Event) {
    const input = event?.target as HTMLInputElement
    if (input.files) {
      const file = input.files[0];
      this.readTheFile(file)
        .then((image) => {
          if (image) {
            this.loadTheImage(image)
          }
        })
    }
  }

  loadTheImage(image: string) {
    const img = new Image();
    const canvas = this.canvas;
    img.onload = function () {
      const context = canvas.getContext('2d');
      context?.clearRect(0, 0, canvas.width, canvas.height);
      context?.drawImage(img, 0, 0);
    };

    img.src = image;
  }

  readTheFile(file: File) {
    const reader = new FileReader();
    return new Promise<string>((resolve) => {
      reader.onload = (event) => {
        resolve(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    })
  }
}