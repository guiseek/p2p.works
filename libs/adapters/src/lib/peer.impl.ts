import {
  Peer,
  Socket,
  Callback,
  Signaling,
  PeerUiState,
  PeerEventMap,
  SignalMessage,
  PeerEventCallback,
} from '@webrtc/ports';

export class PeerImpl implements Peer {
  uuid?: string | undefined;
  meet?: string | undefined;

  conn: RTCPeerConnection;

  stream: MediaStream;
  remote?: MediaStream | undefined;

  uiState: PeerUiState;

  receiveBuffer: ArrayBuffer[] = [];
  public receivedSize = 0;

  private receiveChannel!: RTCDataChannel;
  private sendChannel!: RTCDataChannel;

  events: PeerEventCallback<keyof PeerEventMap>;

  constructor(
    configuration: RTCConfiguration,
    private signaling: Signaling<Socket>
  ) {
    this.conn = new RTCPeerConnection(configuration);

    this.stream = new MediaStream();
    this.uuid = this.stream.id;

    this.events = new Map();

    this.uiState = {
      audio: false,
      video: false,
    };
  }

  public on<K extends keyof PeerEventMap>(
    key: K,
    fn: Callback<PeerEventMap[K]>
  ): void {
    this.events.set(key, fn as () => void);
  }

  public connect(meet?: string): void {
    if (meet) {
      this.meet = meet;
    }

    this.signalUp();
    this.listen();
  }

  public send(message: string): void {
    this.sendChannel.send(message);
  }

  public upload(file: File): void {
    this.sendChannel.binaryType = 'arraybuffer';

    const chunkSize = 16384;
    const fileReader = new FileReader();
    let offset = 0;

    fileReader.onload = ({ target }: ProgressEvent<FileReader>) => {
      const result = target?.result as ArrayBuffer;

      this.sendChannel.send(result);

      offset += result.byteLength;

      if (offset < file.size) readSlice(offset);
    };

    const readSlice = (o: number) => {
      const slice = file.slice(offset, o + chunkSize);
      fileReader.readAsArrayBuffer(slice);
    };

    readSlice(0);
  }

  async signalUp(): Promise<void> {
    await navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then(this.gotStream());

    this.signaling.on('message', (message) => {
      console.log(message);

      this.getSignalMessage()(message)
    });
  }

  listen(): void {
    this.conn.onicecandidate = this.getIceCandidate();

    this.conn.ondatachannel = (evt) => {
      console.log('%c--- RTC Data Channel Event ---', 'color: #FF9900');
      console.log(evt);

      this.receiveChannel = evt.channel;
      this.receiveChannel.onopen = (evt) => {
        console.log('%c--- Receive Channel Open ---', 'color: #FF9900');
        console.log(evt);
      };

      this.receiveChannel.onmessage = (message) => {
        console.log('%c--- Receive Message Event ---', 'color: #FF9900');
        console.log(message instanceof ArrayBuffer);
        if (typeof message === 'string') {
          const event = this.events.get('data');
          if (event) event(message);
        }

        if (typeof message === 'string') {
          this.onReceiveMessageCallback(message);
          const event = this.events.get('data');
          if (event) event(message);
        }
      };
    };

    this.sendChannel = this.conn.createDataChannel('sendDataChannel');
    this.sendChannel.onopen = (evt) => {
      console.log('%c--- Send Channel Open ---', 'color: #FF9900');
      console.log(evt);

      const event = this.events.get('dataChannel');
      if (event) event(this.sendChannel);
    };
    this.sendChannel.onmessage = (message) => {
      console.log('%c--- Send Message Event ---', 'color: #FF9900');
      console.log(message);
    };
  }

  gotStream(): (stream: MediaStream) => void {
    return (stream) => {
      this.stream = stream;

      const [videoTrack] = this.stream.getVideoTracks();
      const [audioTrack] = this.stream.getAudioTracks();

      this.conn.addTrack(videoTrack);
      this.conn.addTrack(audioTrack);

      this.remote = new MediaStream();

      this.conn.ontrack = ({ isTrusted, track }) => {
        const onTrackEvent = this.events.get('track');
        if (onTrackEvent) onTrackEvent(track);

        if (this.remote && isTrusted && track) {
          this.remote.addTrack(track);
        }
      };

      this.conn
        .createOffer()
        .then(this.setDescription())
        .catch(this.errorHandler);
    };
  }

  setDescription(): (description: RTCSessionDescriptionInit) => void {
    return (description) => {
      this.conn.setLocalDescription(description).then(() => {
        const message = {
          sdp: this.conn.localDescription,
          meet: this.meet,
          uuid: this.uuid,
        };
        this.signaling.emit('message', message);
      });
    };
  }

  getSignalMessage(): (message: SignalMessage) => void {
    return ({ uuid, sdp, ice }) => {
      if (uuid === this.uuid) {
        return;
      }

      if (sdp) {
        this.conn
          .setRemoteDescription(new RTCSessionDescription(sdp))
          .then(() => {
            if (sdp.type === 'offer') {
              this.conn
                .createAnswer()
                .then(this.setDescription())
                .catch(this.errorHandler);
            }
          })
          .catch(this.errorHandler);
      } else if (ice) {
        const onCandidateEvent = this.events.get('iceCandidateChange');
        if (onCandidateEvent) onCandidateEvent(ice);

        this.conn
          .addIceCandidate(new RTCIceCandidate(ice))
          .catch(this.errorHandler);
      }
    };
  }

  getIceCandidate(): (event: RTCPeerConnectionIceEvent) => void {
    return (event) => {
      const onIceConnectionEvent = this.events.get('iceConnectionChange');
      if (onIceConnectionEvent) onIceConnectionEvent(event);

      if (event.candidate != null) {
        const message = {
          ice: event.candidate,
          meet: this.meet,
          uuid: this.uuid,
        };
        this.signaling.emit('message', message);
      }
    };
  }

  onReceiveMessageCallback({ data }: MessageEvent<ArrayBuffer>): void {
    console.log(`%c--- Received Message ${data.byteLength}`, 'color: #FF9900');

    this.receiveBuffer.push(data);
    this.receivedSize += data.byteLength;

    if (data.byteLength < 16384) {
      const received = new Blob(this.receiveBuffer);
      this.receiveBuffer = [];
      this.receivedSize = 0;

      const link = document.createElement('a');
      link.href = URL.createObjectURL(received);
      link.download = `download.${received.type}`;
      link.click();
    }
  }

  toggleAudio(stream: MediaStream) {
    const tracks = stream.getAudioTracks();
    tracks.forEach((t) => (t.enabled = !t.enabled));

    this.uiState.audio = !this.uiState.audio;
  }

  toggleVideo(stream: MediaStream) {
    const tracks = stream.getVideoTracks();
    tracks.forEach((t) => (t.enabled = !t.enabled));

    this.uiState.video = !this.uiState.video;
  }

  errorHandler(error: Event): void {
    console.error(error);
  }

  close() {
    const tracks = this.stream.getTracks();
    tracks.forEach((t) => t.stop());
    this.conn.close();
  }
}
