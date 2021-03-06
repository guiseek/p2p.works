import { Signaling, SignalMessage } from '@works/ports';
import { io, Socket } from 'socket.io-client';

export class SignalingImpl implements Signaling<Socket> {
  conn: Socket;

  constructor(readonly signalingServer: string) {
    this.conn = io(signalingServer);
  }

  of(namespace: string, event: string, fn: (message: SignalMessage) => void) {
    this.conn.io.socket(namespace).on(event, fn);
  }

  on(event: string, fn: (message: SignalMessage) => void) {
    this.conn.on(event, fn);
  }

  emit<T>(event: string, message: T) {
    this.conn.emit(event, message);
  }
}
