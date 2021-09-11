import {
  Callback,
  Peer,
  PeerEventCallback,
  PeerEventMap,
  PeerUiState,
  Signaling,
  SignalMessage,
  Socket,
} from '@works/ports';

export class PeerImpl implements Peer {
  user?: string | undefined;
  meet?: string | undefined;

  conn: RTCPeerConnection;

  stream: MediaStream;
  remote?: MediaStream | undefined;

  uiState: PeerUiState;

  receiveName?: string;
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
    this.user = this.stream.id;

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

      if (offset === 0) {
        this.send(file.name);
      }

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
      .getUserMedia(this.getConfig())
      .then(this.gotStream());

    this.signaling.on('message', (message) => {
      this.getSignalMessage()(message);
    });
  }

  getConfig() {
    let audio: string | Partial<MediaDeviceInfo> =
      localStorage.getItem('audio') ?? 'true';
    let video: string | Partial<MediaDeviceInfo> =
      localStorage.getItem('video') ?? 'true';

    if (audio) {
      const { deviceId } = JSON.parse(audio as string);
      audio = { deviceId };
    }
    if (video) {
      const { deviceId } = JSON.parse(video as string);
      video = { deviceId };
    }

    return { audio, video } as MediaStreamConstraints;
  }

  listen(): void {
    this.conn.onicecandidate = this.getIceCandidate();

    this.conn.ondatachannel = (evt) => {
      this.receiveChannel = evt.channel;
      this.receiveChannel.onmessage = (message) => {
        if (typeof message.data === 'string') {
          this.receiveName = message.data;
          const event = this.events.get('data');
          if (event) event(message.data);
        }

        if (message.data instanceof ArrayBuffer) {
          this.onReceiveMessageCallback(message);
          const event = this.events.get('data');
          if (event) event(message.data);
        }
      };
    };

    this.sendChannel = this.conn.createDataChannel('sendDataChannel');
    this.sendChannel.onopen = () => {
      const event = this.events.get('dataChannel');
      if (event) event(this.sendChannel);
    };
  }

  gotStream(): (stream: MediaStream) => void {
    return (stream) => {
      this.stream = stream;

      const onStreamEvent = this.events.get('stream');
      if (onStreamEvent) onStreamEvent(stream);

      const [videoTrack] = this.stream.getVideoTracks();
      const [audioTrack] = this.stream.getAudioTracks();

      this.conn.addTrack(videoTrack);
      this.conn.addTrack(audioTrack);

      this.remote = new MediaStream();

      this.conn.ontrack = ({ isTrusted, track }) => {
        if (this.remote && isTrusted && track) {
          this.remote.addTrack(track);
        }

        const onTrackEvent = this.events.get('track');
        if (onTrackEvent) onTrackEvent(track);
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
          user: this.user,
        };
        this.signaling.emit('message', message);
      });
    };
  }

  getSignalMessage(): (message: SignalMessage) => void {
    return ({ user, sdp, ice }) => {
      if (user === this.user) {
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
        this.conn
          .addIceCandidate(new RTCIceCandidate(ice))
          .catch(this.errorHandler);

        const onCandidateEvent = this.events.get('iceCandidateChange');
        if (onCandidateEvent) onCandidateEvent(ice);
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
          user: this.user,
        };
        this.signaling.emit('message', message);
      }
    };
  }

  onReceiveMessageCallback({ data }: MessageEvent<ArrayBuffer>): void {
    this.receiveBuffer.push(data);
    this.receivedSize += data.byteLength;

    if (data.byteLength < 16384) {
      const received = new Blob(this.receiveBuffer);

      this.receiveBuffer = [];
      this.receivedSize = 0;

      if (this.receiveName) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(received);
        link.download = this.receiveName;
        link.click();

        delete this.receiveName;
      }
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

  errorHandler(error: RTCPeerConnectionIceErrorEvent): void {
    console.error(error);
  }

  close() {
    const tracks = this.stream.getTracks();
    tracks.forEach((t) => t.stop());
    this.conn.close();
  }
}
