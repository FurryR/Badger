export abstract class Message {
  constructor(
    public start: number,
    public end: number,
    public message: string
  ) {}
}

export class Info extends Message {}

export class Error extends Message {}

export class Warning extends Message {}
